/*

 * simple key-stroke & mouse driven UI for WV
 *
 * Notes: g.sceneUpd should be set to 1 if the scene should rerendered
 *        g.sgUpdate will be set to 1 if the sceneGraph has changed
 *                   sould be set back to 0 after UI responds
 */


//
// Event Handlers

var NO_MODIFIER = 0;
var ALT_KEY = 1;
var SHIFT_KEY = 2;
var CTRL_KEY = 4;
var META_KEY = 8;
var WHEEL_DELTA = 120;

// work around for global variables
var brch=0;
var pmtr=0;
function getCursorXY(e) 
{
  if (!e) e = event;
  g.cursorX  = e.clientX;
  g.cursorY  = e.clientY;
  g.cursorX -= g.offLeft+1;
  g.cursorY  = g.height-g.cursorY+g.offTop+1;

  g.modifier = 0;
  if (e.shiftKey) g.modifier |= SHIFT_KEY;
  if (e.altKey)   g.modifier |= ALT_KEY;
  if (e.ctrlKey)  g.modifier |= CTRL_KEY;
}
 

function getMouseDown(e) 
{
  if (!e) e = event;
  g.startX   = e.clientX;
  g.startY   = e.clientY;
  g.startX  -= g.offLeft+1;
  g.startY   = g.height-g.startY+g.offTop+1;

  g.dragging = true;
  g.button   = e.button;
  g.modifier = 0;
  if (e.shiftKey) g.modifier |= SHIFT_KEY;
  if (e.altKey)   g.modifier |= ALT_KEY;
  if (e.ctrlKey)  g.modifier |= CTRL_KEY;
  if (e.metaKey)  g.modifier |= META_KEY;
}


function getMouseUp(e) 
{
  g.dragging = false;
}


function getKeyPress(e)
{
  if (!e) e = event;
  g.keyPress = e.charCode;
}

function getMouseWheel(e)
{
  if (!e) e=event;
  g.wheelDelta = e.wheelDelta/WHEEL_DELTA;
}
//
// Required WV functions


function wvUpdateCanvas(gl)
{
  // Show the status line
  g.statusline.snapshot();
}


function wvInitUI()
{

  // set up extra storage for matrix-matrix multiplies
  g.uiMatrix = new J3DIMatrix4();
  
                                // ui cursor variables
  g.cursorX  = -1;              // current cursor position
  g.cursorY  = -1;
  g.keyPress = -1;              // last key pressed
  g.startX   = -1;              // start of dragging position
  g.startY   = -1;
  g.button   = -1;              // button pressed
  g.modifier =  0;              // modifier (shift,alt,cntl) bitflag
  g.offTop   =  0;              // offset to upper-left corner of the canvas
  g.offLeft  =  0;
  g.dragging = false;
  g.wheelDelta = 0;             // delta for mouse wheel
  
  var canvas = document.getElementById("WebViewer");
    canvas.addEventListener('mousemove',  getCursorXY,  false);
    canvas.addEventListener('mousedown',  getMouseDown, false);
    canvas.addEventListener('mouseup',    getMouseUp,   false);
    canvas.addEventListener('mousewheel', getMouseWheel, false);
  document.addEventListener('keypress',   getKeyPress,  false);

  g.statusline = new StatusLine("statusline");
  g.debug = true;

}

function getDisplayControl(display, isActive){

    isActive = isActive ? "active" : "";

    return " \
            <button type='button' class='btn btn-primary btn-small " + display + " " + isActive + "'> \
                <span>" + display + "</span> \
            </button>";
}

function getDisplayControls(attrs){
    return jQuery("<div class='btn-group' data-toggle='buttons-checkbox'></div>")
                .append(getDisplayControl("viz", isAttributeSet(attrs, g.plotAttrs.ON)),
                        getDisplayControl("grd", isAttributeSet(attrs, g.plotAttrs.LINES | g.plotAttrs.POINTS)),
                        getDisplayControl("trn", isAttributeSet(attrs, g.plotAttrs.TRANSPARENT)),
                        getDisplayControl("ori", isAttributeSet(attrs, g.plotAttrs.ORIENTATION)));

}

function handleControlClick(attribute, mask){
    
    function updateTree( root, flag ){
        var control = getNodeControl( root, attribute );
        var activateControl = !isControlActive( control );
        var children = getNodeChildren( root );

        var data = undefined;
        var dataKey = "gprim";

        if( children.length > 0  ){
            dataKey = "attrs";
            data = getNodeData( root, dataKey );
            
            data = setAttribute( getNodeData( root, dataKey ), mask, flag );
            setNodeData( root, dataKey, data );

            children.each( function( index, child ){
                child = jQuery(child);
                setNodeControl( child, getNodeControl( child, attribute ), activateControl );     
                updateTree( child, flag );
            });
        }

        else{
            data = getNodeData( root, dataKey );
            data.attrs = setAttribute( data.attrs, mask, flag );
            setNodeData( root, dataKey, data );
        }
    }

    return function( e ){
        var root = jQuery( this ).is( "button" ) ? jQuery( this ).parent().parent() : jQuery( this ).parent();
        var data = getNodeData( root, "gprim" );

        data =  data ? data.attrs : getNodeData( root, "attrs" );

        var flag = data & mask > 0 ? 0 : mask;

        updateTree( root, flag );
        g.sceneUpd = 1;
    };
}

function isControlActive( control ){
    return control.hasClass( "active" );
}

function isAttributeSet(setValue, currentValue){
    return (currentValue & setValue) >= 1;
} 

function setAttribute(attributes, mask, value){
    return (attributes & (~mask)) | (value & mask);
}

function getNode(id){
    return jQuery.jstree._reference( "#tree" )._get_node( "#" + id );
}

function getNodeChildren(node){
    return jQuery.jstree._reference( "#tree" )._get_children( node );
}

function gprimToId(gprim){
    return gprim.replace(/ /g, "_");
}

function setNodeData(node, dataKey, data){
    node.data(dataKey, data);
}

function getNodeData(node, dataKey){
    return node.data(dataKey);
}

function getNodeControl(node, controlName){
    return jQuery( "." + controlName, node).first();
}

function setNodeControl(node, control, activate){
    if( activate ){
        control.addClass("active");
    }
    else{
        control.removeClass("active");
    }
}

function wvUpdateUI()
{
// if the tree has not been created but the scene graph (possibly) exists...
// if the scene graph and Parameters have been updated, (re-)build the Tree
    if (g.sgUpdate == 1){ 

        if (g.sceneGraph === undefined) {
            alert("g.sceneGraph is undefined --- but we need it");
        }

        var nodes = [[],[]];
        var parentIndex = 0;
        var node = undefined; 

        if( jQuery("#tree").length === 0 ){
            for( var gprim in g.sceneGraph ){
                parentIndex = ( g.sceneGraph[gprim].GPtype === 1 ) ? 0 : 1;
                
                node = jQuery("<li id='" + gprimToId(gprim) + "'><a href='#'>" + gprim + "</a></li>");
                node.data("gprim", g.sceneGraph[gprim]);
                node.append(getDisplayControls( g.sceneGraph[gprim].attrs ) );

                nodes[parentIndex].push(node);
            }

            var edges = jQuery("<ul></ul>");
            var faces = jQuery("<ul></ul>");
            var tree = jQuery("<ul></ul>");

            edges.append(nodes[0]);
            faces.append(nodes[1]);
            
            edges = jQuery("<li id='Edges'><a href='#'>Edges</a></li>").append(edges);
            faces = jQuery("<li id='Faces'><a href='#'>Faces</li>").append(faces);
            
            jQuery("ul", edges).before(getDisplayControls( 1 ));
            jQuery("ul", faces).before(getDisplayControls( 9 ));

            edges.data("attrs", 1);
            faces.data("attrs", 9);

            tree.append(edges, faces);
            tree = jQuery("<div id='tree'></div>").append(tree);

            jQuery("#leftframe").append(tree);
                
            jQuery(".viz").click(handleControlClick("viz", g.plotAttrs.ON));
            jQuery(".grd").click(handleControlClick("grd", g.plotAttrs.LINES | g.plotAttrs.POINTS));
            jQuery(".trn").click(handleControlClick("trn", g.plotAttrs.TRANSPARENT));
            jQuery(".ori").click(handleControlClick("ori", g.plotAttrs.ORIENTATION));

            jQuery("#tree").jstree({
                "plugins" : ["html_data", "themes", "ui", "sort"],

                "themes" : { 
                    "theme" : "openmdao",
                },
            });

            
        }
            

        g.sgUpdate = 0;
    }

  if (g.keyPress != -1) 
  {
  
    if (g.keyPress == 42)       // '*' -- center the view
      g.centerV = 1;

    //if (g.keyPress == 60)       // '<' -- finer tessellation
     // g.socketUt.send("coarser");
      
    //if (g.keyPress == 62)       // '>' -- finer tessellation
     // g.socketUt.send("finer");

    if (g.keyPress ==  76)      // 'L' -- locating state
      if (g.locate == 1)
      {
        g.locate = 0;
      } else {
        g.locate = 1;
      }
  
    if (g.keyPress ==  80)      // 'P' -- picking state
      if (g.pick == 1) 
      {
        g.pick     = 0;
      } else {
        g.pick     = 1;
        g.sceneUpd = 1;
      }

    if (g.keyPress ==  99)      // 'c' -- color state
      if (g.active !== undefined) 
      {
        g.sceneGraph[g.active].attrs ^= g.plotAttrs.SHADING;
        g.sceneUpd = 1;
      }
      
    if (g.keyPress == 104)      // 'h' -- home (reset view transformation)
    {
      g.mvMatrix.makeIdentity();
      g.scale    = 1.0;
      g.sceneUpd = 1;
    }
        
    if (g.keyPress == 108)      // 'l' -- line state
      if (g.active !== undefined)
      {
        g.sceneGraph[g.active].attrs ^= g.plotAttrs.LINES;
        g.sceneUpd = 1;
      }

    if (g.keyPress == 110)      // 'n' -- next active
    {
      for (var gprim in g.sceneGraph)
      {
        if (g.active === undefined)
        {
          g.active = gprim;
          break;
        }
        if (g.active == gprim) g.active = undefined;
      }
    }

    if (g.keyPress == 111)      // 'o' -- orientation state
      if (g.active !== undefined)
      {
        g.sceneGraph[g.active].attrs ^= g.plotAttrs.ORIENTATION;
        g.sceneUpd = 1;
      }
        
    if (g.keyPress == 112)      // 'p' -- point state
      if (g.active !== undefined)
      {
        g.sceneGraph[g.active].attrs ^= g.plotAttrs.POINTS;
        g.sceneUpd = 1;
      }

    if (g.keyPress == 114)      // 'r' -- render state
      if (g.active !== undefined)
      {
        g.sceneGraph[g.active].attrs ^= g.plotAttrs.ON;
        g.sceneUpd = 1;
      }

    if (g.keyPress == 115)      // 's' -- set active to picked
      if (g.picked !== undefined) g.active = g.picked.gprim;

    if (g.keyPress == 116)      // 't' -- transparent state
      if (g.active !== undefined)
      {
        g.sceneGraph[g.active].attrs ^= g.plotAttrs.TRANSPARENT;
        g.sceneUpd = 1;
      }
  }
  g.keyPress = -1;

  //
  // UI is in screen coordinates (not object)
  g.uiMatrix.load(g.mvMatrix);
  g.mvMatrix.makeIdentity();

  if (g.wheelDelta !== 0)
  {
    var scale = Math.exp(g.wheelDelta/32.0);
    g.mvMatrix.scale(scale, scale, scale);
    g.scale   *= scale;
    g.sceneUpd = 1;
    g.wheelDelta = 0;
  }
  //
  // now mouse movement
  if (g.dragging) 
  {
    console.log("Something is busted.");
    // alt and shift key is down
    if (g.modifier & (META_KEY) || g.modifier & (META_KEY | CTRL_KEY) || g.modifier & CTRL_KEY )
    {
      var angleX =  (g.startY-g.cursorY)/4.0;
      var angleY = -(g.startX-g.cursorX)/4.0;
      if ((angleX !== 0.0) || (angleY !== 0.0))
      {
        g.mvMatrix.rotate(angleX, 1,0,0);
        g.mvMatrix.rotate(angleY, 0,1,0);
        g.sceneUpd = 1;
      }
    }
    
    // alt is down
    if (g.modifier & ALT_KEY )
    {
      var xf = g.startX - g.width/2;
      var yf = g.startY - g.height/2;
      if ((xf !== 0.0) || (yf !== 0.0)) 
      {
        var theta1 = Math.atan2(yf, xf);
        xf = g.cursorX - g.width/2;
        yf = g.cursorY - g.height/2;
        if ((xf !== 0.0) || (yf !== 0.0)) 
        {
          var dtheta = Math.atan2(yf, xf)-theta1;
          if (Math.abs(dtheta) < 1.5708)
          {
            var angleZ = 128*(dtheta)/3.1415926;
            g.mvMatrix.rotate(angleZ, 0,0,1);
            g.sceneUpd = 1;
          }
        }
      }
    }

    // no modifier
    if (g.modifier === NO_MODIFIER)
    {
      var transX = (g.cursorX-g.startX)/256.0;
      var transY = (g.cursorY-g.startY)/256.0;
      if ((transX !== 0.0) || (transY !== 0.0))
      {
        g.mvMatrix.translate(transX, transY, 0.0);
        g.sceneUpd = 1;
      }
    }

    g.startX = g.cursorX;
    g.startY = g.cursorY;
  }
}


function wvUpdateView()
{
  g.mvMatrix.multiply(g.uiMatrix);
}


function wvServerMessage(text)
{
  logger(" Server Message: " + text);
}

function reshape(gl)
{
    var canvas = document.getElementById('WebViewer');

    canvas.height = window.innerHeight * 0.95;
    canvas.width = jQuery("#riteframe").parent().width();

    if (g.offTop !== canvas.offsetTop || g.offLeft !== canvas.offsetLeft) {
        g.offTop  = canvas.offsetTop;
        g.offLeft = canvas.offsetLeft;
    }

    if (g.width === canvas.width && g.height === canvas.height) return;

    g.width  = canvas.width;
    g.height = canvas.height;

    // Set the viewport and projection matrix for the scene
    gl.viewport(0, 0, g.width, g.height);
    g.perspectiveMatrix = new J3DIMatrix4();
    g.sceneUpd = 1;

    wvInitDraw();
}

//
// put out a cursor
function jack(gl, x,y,z, delta)
{
  if (g.sceneGraph["jack"] !== undefined)
  {
    deleteGPrim(gl, "jack");
    delete g.sceneGraph["jack"];
  }

  var vertices = new Float32Array(18);
  for (var i = 0; i < 6; i++)
  {
    vertices[3*i  ] = x;
    vertices[3*i+1] = y;
    vertices[3*i+2] = z;
  }
  vertices[ 0] -= delta;
  vertices[ 3] += delta;
  vertices[ 7] -= delta;
  vertices[10] += delta;
  vertices[14] -= delta;
  vertices[17] += delta;
  
  var vbo = createVBO(gl, vertices,  undefined,
                          undefined, undefined);
  g.sceneGraph["jack"] = createGPrim(1, 1, g.plotAttrs.ON);
  g.sceneGraph["jack"].lines[0]  = vbo;
  g.sceneGraph["jack"].lineWidth = 3;
  g.sceneGraph["jack"].lColor    = [0.0, 0.0, 1.0];
  
}

//
// Status Line object
//
// This object keeps track of framerate plus other wv data and displays it as 
// the innerHTML text of the HTML element with the passed id. Once created you 
// call snapshot at the end of every rendering cycle. Every 500ms the framerate 
// is updated in the HTML element.
//

StatusLine = function(id)
{
    this.id = id;
    this.numFramerates = 10;
    this.framerateUpdateInterval = 500;

    this.renderTime = -1;
    this.framerates = [ ];
    var self = this;
    var fr = function() { self.updateFramerate(); };
    setInterval(fr, this.framerateUpdateInterval);
};


StatusLine.prototype.updateFramerate = function()
{
    var sline = document.getElementById(this.id);
    if (sline === null) {
      return;
    }
    var tot = 0;
    for (var i = 0; i < this.framerates.length; ++i)
        tot += this.framerates[i];

    var framerate = tot / this.framerates.length;
    framerate = Math.round(framerate);
    var string = "Framerate:"+framerate+"fps";
    if (g.picked !== undefined) 
      string = string+"&nbsp; &nbsp; &nbsp; Picked: "+g.picked.gprim+
                      "  strip = "+g.picked.strip+"  type = "+g.picked.type;
    if (g.active !== undefined) 
      string = string+"&nbsp; &nbsp; &nbsp; Active: "+g.active;
    if (g.located !== undefined)
      string = string+"&nbsp; &nbsp; &nbsp; ("+g.located[0]+", &nbsp; "+
                      g.located[1]+", &nbsp; "+g.located[2]+")";
              
    sline.innerHTML = string;
 };


StatusLine.prototype.snapshot = function()
{
    if (this.renderTime < 0)
        this.renderTime = new Date().getTime();
    else {
        var newTime = new Date().getTime();
        var t = newTime - this.renderTime;
        if (t === 0)
            return;
        var framerate = 1000/t;
        this.framerates.push(framerate);
        while (this.framerates.length > this.numFramerates)
            this.framerates.shift();
        this.renderTime = newTime;
    }
};
