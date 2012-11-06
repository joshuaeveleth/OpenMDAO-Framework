"""
Tests of workflow functions.
"""

import pkg_resources
import sys

from nose.tools import eq_ as eq
from nose.tools import with_setup


if sys.platform != 'win32':  # No testing on Windows yet.
    from util import main, setup_server, teardown_server, generate, \
                     startup, closeout

    @with_setup(setup_server, teardown_server)
    def test_generator():
        for _test, browser in generate(__name__):
            yield _test, browser


def _test_global(browser):
    # 'global' view should be populated (originally was blank).
    projects_page, project_info_page, project_dict, workspace_page = startup(browser)

    filename = pkg_resources.resource_filename('openmdao.gui.test.functional',
                                               'rosen_suzuki.py')
    workspace_page.add_file(filename)

    # Add a NestedSimulation.
    workspace_page.set_library_filter('In Project')
    workspace_page.add_library_item_to_dataflow('rosen_suzuki.NestedSimulation',
                                                'nested', offset=(300, 300))
    # Verify full workflow shown.
    workspace_page('workflow_tab').click()
    eq(len(workspace_page.get_workflow_figures()), 3)
    eq(len(workspace_page.get_workflow_component_figures()), 6)

    # Clean up.
    closeout(projects_page, project_info_page, project_dict, workspace_page)


def _test_update(browser):
    # Adding a parameter to a driver should update the driver's workflow.
    projects_page, project_info_page, project_dict, workspace_page = startup(browser)

    # Create model with CONMIN and ExecComp.
    workspace_page.show_dataflow('top')
    workspace_page.replace('driver',
                           'openmdao.lib.drivers.conmindriver.CONMINdriver')
    workspace_page.add_library_item_to_dataflow(
        'openmdao.test.execcomp.ExecComp', 'exe', args=["('z = x * y',)"])

    # Add parameter to CONMIN.
    driver = workspace_page.get_dataflow_figure('driver', 'top')
    editor = driver.editor_page(base_type='Driver')
    editor('parameters_tab').click()
    dialog = editor.new_parameter()
    dialog.target = 'exe.x'
    dialog.low = '-1'
    dialog.high = '1'
    dialog('ok').click()
    editor.close()

    # Verify workflow contains ExecComp.
    workspace_page('workflow_tab').click()
    eq(len(workspace_page.get_workflow_figures()), 1)
    eq(len(workspace_page.get_workflow_component_figures()), 2)

    # Clean up.
    closeout(projects_page, project_info_page, project_dict, workspace_page)


if __name__ == '__main__':
    main()

