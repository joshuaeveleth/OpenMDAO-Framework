
#
# For each openmdao subpackage, this script creates a releaseinfo.py file and 
# builds a source distribution.
#
import sys, os
import shutil
import logging
from subprocess import Popen, STDOUT, PIPE, check_call
from datetime import date
from optparse import OptionParser
import tempfile
import StringIO
import tarfile
import zipfile

# this module requires openmdao.devtools to be installed in the python environment

# this should contain all of the openmdao subpackages
openmdao_packages = { 'openmdao.main': '', 
                      'openmdao.lib': '', 
                      'openmdao.util': '', 
                      'openmdao.units': '', 
                      'openmdao.test': '', 
                      'openmdao.examples.simple': 'examples',
                      'openmdao.examples.bar3simulation': 'examples',
                      'openmdao.examples.mdao': 'examples',
                      'openmdao.examples.enginedesign': 'examples',
                      'openmdao.examples.expected_improvement': 'examples',
                      }

# build binary eggs for these projects in addition to source dists
bin_projects = [ 
    'openmdao.examples.bar3simulation',
    'openmdao.examples.enginedesign'
]

relfile_template = """
# This file is automatically generated

__version__ = '%(version)s'
__revision__ = \"\"\"%(revision)s\"\"\"
__date__ = '%(date)s'
"""

def get_revision():
    try:
        p = Popen('bzr log -r-1', 
                  stdout=PIPE, stderr=STDOUT, env=os.environ, shell=True)
        out = p.communicate()[0]
        ret = p.returncode
    except:
        return 'No revision info available'
    else:
        lines = [x for x in out.split('\n') if not x.startswith('----------')
                                               and not x.startswith('Use --include-merges')]
        return '\n'.join(lines)

def get_releaseinfo_str(version):
    """Creates the content of the releaseinfo.py files"""
    opts = {}
    f = StringIO.StringIO()
    opts['version'] = version
    opts['date'] = date.today().isoformat()
    opts['revision'] = get_revision()
    f.write(relfile_template % opts)
    return f.getvalue()


def create_releaseinfo_file(projname, relinfo_str):
    """Creates a releaseinfo.py file in the current directory"""
    opts = {}
    dirs = projname.split('.')
    os.chdir(os.path.join(*dirs))
    print 'creating releaseinfo.py for %s' % projname
    f = open('releaseinfo.py', 'w')
    try:
        f.write(relinfo_str)
    finally:
        f.close()

def _has_checkouts():
    cmd = 'bzr status -S'
    p = Popen(cmd, stdout=PIPE, stderr=STDOUT, env=os.environ, shell=True)
    out = p.communicate()[0]
    ret = p.returncode
    if ret != 0:
        logging.error(out)
        raise RuntimeError(
             'error while getting status of bzr repository from directory %s (return code=%d): %s'
              % (os.getcwd(), ret, out))
    for line in out.split('\n'):
        # in the bzr status short output, any of the letters N,D,K, or M in the 2nd column
        # indicate that an uncommitted change exists in the repository
        # FIXME: find a more robust way to do this
        if len(line)>1 and line[1] in 'NDKM':
            return True
    return False

def _build_dist(build_type, destdir):
    cmd = '%s setup.py %s -d %s' % (sys.executable, build_type, destdir)
    p = Popen(cmd, stdout=PIPE, stderr=STDOUT, env=os.environ, shell=True)
    out = p.communicate()[0]
    ret = p.returncode
    if ret != 0:
        logging.error(out)
        raise RuntimeError(
             'error while building %s in %s (return code=%d): %s'
              % (build_type, os.getcwd(), ret, out))

def _build_sdist(projdir, destdir, version):
    """Build an sdist out of a develop egg."""
    startdir = os.getcwd()
    try:
        os.chdir(projdir)
        # clean up any old builds
        if os.path.exists('build'):
            shutil.rmtree('build')
        _build_dist('sdist', destdir)
        if os.path.exists('build'):
            shutil.rmtree('build', ignore_errors=True)
        if sys.platform == 'win32':
            os.chdir(destdir)
            # unzip the .zip file and tar it up so setuptools will find it on the server
            base = os.path.basename(projdir)+'-%s' % version
            zipname = base+'.zip'
            tarname = base+'.tar.gz'
            zarch = zipfile.ZipFile(zipname, 'r')
            zarch.extractall()
            zarch.close()
            archive = tarfile.open(tarname, 'w:gz')
            archive.add(base)
            archive.close()
            os.remove(zipname)
            shutil.rmtree(base)
    finally:
        os.chdir(startdir)

def _build_bdist_egg(projdir, destdir):
    startdir = os.getcwd()
    try:
        os.chdir(projdir)
        _build_dist('bdist_egg', destdir)
    finally:
        os.chdir(startdir)

def _find_top_dir():
    path = os.getcwd()
    while path:
        if '.bzr' in os.listdir(path):
            return path
        path = os.path.dirname(path)
    raise RuntimeError("Can't find top dir of repository starting at %s" % os.getcwd())

    
#def _create_pseudo_egg(version, destination):
    #"""This makes the top level openmdao egg that depends on all of the
    #openmdao namespace packages.
    #"""
    
    #setup_template = """
#from setuptools import setup

#setup(name='openmdao',
      #version='%(version)s',
      #description="A framework for multidisciplinary analysis and optimization.",
      #long_description="",
      #classifiers=[
        #"Programming Language :: Python :: 2.6",
        #"Development Status :: 2 - Pre-Alpha",
        #"Topic :: Scientific/Engineering",
        #"Intended Audience :: Science/Research",
        #"License :: OSI Approved",
        #"Natural Language :: English",
        #"Operating System :: OS Independent",
        #],
      #keywords='multidisciplinary optimization',
      #url='http://openmdao.org',
      #license='NOSA',
      #namespace_packages=[],
      #packages = [],
      #dependency_links = [ 'http://openmdao.org/dists' ],
      #zip_safe=False,
      #install_requires=[
          #'setuptools',
          #'openmdao.lib==%(version)s',
          #'openmdao.main==%(version)s',
          #'openmdao.util==%(version)s',
          #'openmdao.test==%(version)s',
          #'openmdao.examples.simple==%(version)s',
          #'openmdao.examples.bar3simulation==%(version)s',
          #'openmdao.examples.enginedesign==%(version)s',
      #],
      #)
    #"""
    #startdir = os.getcwd()
    #tdir = tempfile.mkdtemp()
    #os.chdir(tdir)
    #try:
        #with open('setup.py','wb') as f:
            #f.write(setup_template % { 'version': version })
        #os.mkdir('openmdao')
        #with open(os.path.join('openmdao', '__init__.py'), 'wb') as f:
            #f.write("""
#try:
    #__import__('pkg_resources').declare_namespace(__name__)
#except ImportError:
    #from pkgutil import extend_path
    #__path__ = extend_path(__path__, __name__)""")
    
        #_build_sdist(tdir, destination, version)
    #finally:
        #os.chdir(startdir)
        #shutil.rmtree(tdir)
    
def main():
    """Create an OpenMDAO release, placing the following files in the specified destination
    directory:
    
        - a tar file of the repository
        - source distribs of all of the openmdao subpackages
        - binary eggs for openmdao subpackages with compiled code
        - an installer script for the released version of openmdao that will
          create a virtualenv and populate it with all of the necessary
          dependencies needed to use openmdao
          
    The sphinx docs will also be built.
          
    In order to run this, you must be in a bzr repository that has not changed since
    the last commit, and in the process of running, a number of releaseinfo.py files
    and the sphinx conf.py file will be updated with new version information and will 
    be commited with the comment 'updated revision info and conf.py files'.
        
    """
    parser = OptionParser()
    parser.add_option("-d", "--destination", action="store", type="string", dest="destdir",
                      help="directory where distributions will be placed")
    parser.add_option("-t", "--test", action="store_true", dest="test",
                      help="if present, release will be a test release (no repo tag, commit not required)")
    parser.add_option("--version", action="store", type="string", dest="version",
                      help="version string applied to all openmdao distributions")
    (options, args) = parser.parse_args(sys.argv[1:])
    
    if not options.version or not options.destdir:
        parser.print_help()
        sys.exit(-1)
        
    topdir = _find_top_dir()
    
    if not options.test:
        if _has_checkouts():
            print 'ERROR: Creating a release requires that all changes have been committed'
            sys.exit(-1)
        
    destdir = os.path.realpath(options.destdir)
    if not os.path.exists(destdir):
        os.makedirs(destdir)

    releaseinfo_str = get_releaseinfo_str(options.version)
    startdir = os.getcwd()
    tarname = os.path.join(destdir,
                           'openmdao_src-%s.tar.gz' % options.version)
    try:
        for project_name in openmdao_packages:
            pdir = os.path.join(topdir, 
                                openmdao_packages[project_name], 
                                project_name)
            if 'src' in os.listdir(pdir):
                os.chdir(os.path.join(pdir, 'src'))
            else:
                os.chdir(pdir)
            create_releaseinfo_file(project_name, releaseinfo_str)

        # build the docs
        devtools_dir = os.path.join(topdir,'openmdao.devtools',
                                    'src','openmdao','devtools')
        check_call([sys.executable, os.path.join(devtools_dir,'build_docs.py')])
        shutil.move(os.path.join(topdir,'docs','_build'), 
                    os.path.join(destdir,'_build'))
        if not options.test:
            check_call(['bzr', 'commit', '-m', 
                        '"updating release info and sphinx config files for release %s"' % options.version])

        for project_name in openmdao_packages:
            pdir = os.path.join(topdir, 
                                openmdao_packages[project_name], 
                                project_name)
            if 'src' in os.listdir(pdir):
                os.chdir(os.path.join(pdir, 'src'))
            else:
                os.chdir(pdir)
            print 'building %s' % project_name
            _build_sdist(pdir, destdir, options.version)
            if project_name in bin_projects:
                _build_bdist_egg(pdir, destdir)
            
        #print 'building openmdao'
        #_create_pseudo_egg(options.version, destdir)
        
        print 'exporting archive of repository to %s' % tarname
        check_call(['bzr', 'export', '%s' % tarname])
    
        print 'creating bootstrapping installer script go-openmdao.py'
        installer = os.path.join(topdir, 'scripts','mkinstaller.py')
        if options.test:
            check_call([sys.executable, installer, '-t', '--dest=%s'%destdir])
        else:
            check_call([sys.executable, installer, '--dest=%s'%destdir])
        
        # tag the current revision with the release version id
        if not options.test:
            check_call(['bzr', 'tag', '--force', options.version])
    finally:
        os.chdir(startdir)
    
if __name__ == '__main__':
    main()
