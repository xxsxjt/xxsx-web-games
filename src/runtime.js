(function(){
'use strict';

function create(name){
  var intervals=[],timeouts=[];
  function forget(list,id){
    var index=list.indexOf(id);
    if(index>=0)list.splice(index,1);
  }
  return {
    name:name,
    setInterval:function(fn,delay){
      var id=window.setInterval(fn,delay);intervals.push(id);return id;
    },
    setTimeout:function(fn,delay){
      var id=window.setTimeout(fn,delay);timeouts.push(id);return id;
    },
    clearInterval:function(id){
      if(id){window.clearInterval(id);forget(intervals,id);}
    },
    clearTimeout:function(id){
      if(id){window.clearTimeout(id);forget(timeouts,id);}
    },
    clearAll:function(){
      intervals.slice().forEach(function(id){window.clearInterval(id);});
      timeouts.slice().forEach(function(id){window.clearTimeout(id);});
      intervals.length=0;timeouts.length=0;
    },
    activeCount:function(){return intervals.length+timeouts.length;}
  };
}

window.NeonRuntime={create:create};
})();
