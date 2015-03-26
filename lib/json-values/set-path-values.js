module.exports = set_path_values_as_values;

var $path = "path";
var clone = require("./clone");
var walk_pathset = require("../json-sparse/walk-path-set");
var is_object    = require("../support/is-object");
var is_primitive = require("../support/is-primitive");
var array_clone  = require("../support/array-clone");

var inc_version  = require("../support/inc-version");
var inc_generation = require("../support/inc-generation");

var wrap_node    = require("../support/wrap-node");
var update_back_refs = require("../support/update-back-refs");
var replace_node = require("../support/replace-node");
var graph_node   = require("../support/graph-node");
var update_tree  = require("../support/update-tree");

function set_path_values_as_values(model, pathvalues, values) {
    
    var root    = model._cache;
    var bound   = [];
    var errors  = [];
    var onNext  = typeof values == "function" && values || undefined;
    var roots   = [root];
    var nodes   = [root];
    var index   = -1;
    var count   = pathvalues.length;
    
    roots.r = [];
    roots.o = [];
    roots.reqs = [];
    roots.opts = [];
    roots.bound = bound;
    roots.lru   = model._root;
    roots.version = inc_version();
    roots.values  = values;
    roots.onNext  = onNext;
    roots.boxed = model._boxed || false;
    roots.expired = model._root.expired;
    roots.materialized = model._materialized || false;
    roots.errorsAsValues = model._errorsAsValues || false;
    
    while(++index < count) {
        var pv      = pathvalues[index];
        var pathset = pv.path;
        roots.value = pv.value;
        walk_pathset(on_node, on_edge, on_link, pathset, roots, nodes, nodes, bound, bound);
    }
        
    return {
        values: values,
        errors: errors,
        requestedPaths: roots.r,
        optimizedPaths: roots.o,
        requestedMissingPaths: roots.reqs,
        optimizedMissingPaths: roots.opts
    };

}

function on_node(pathset, roots, parents, nodes, requested, optimized, key) {
    
    var parent = parents[0] = nodes[0];
    var node   = nodes[0]   = parent[key];
    
    if(pathset.length > 1) {
        var type = node && node.$type || undefined;
        if((!!type && type != $path) || is_primitive(node)) {
            
            var root = roots[0];
            
            node = replace_node(parent, node, {}, key, roots.lru);
            node = graph_node(root, parent, node, key, 0);
            node = update_back_refs(node, roots.version);
            nodes[0] = node;
            type = undefined;
        }
    }
}

function on_edge(pathset, roots, parents, nodes, requested, optimized, key) {
    
    var reqs = roots.r;
    var opts = roots.o;
    reqs[reqs.length] = array_clone(requested);
    opts[opts.length] = array_clone(optimized);
    
    if(key == null) { return; }
    
    var root    = roots[0];
    var parent  = parents[0];
    var node    = nodes[0];
    var size    = node && node.$size || 0;
    
    var message = roots.value;
    var type    = message && message.$type || undefined;
    var value   = !!type ? message.value : message;
    
    message = wrap_node(message, type, value);
    
    node = replace_node(parent, node, message, key, roots.lru);
    node = graph_node(root, parent, node, key, inc_generation());
    type = node.$type;
    
    var offset = size - node.$size;
    
    update_tree(parent, offset, roots.version, roots.lru);
    
    var onNext = roots.onNext, values;
    if(onNext) {
        onNext(clone(roots, node, value, requested));
    } else if(values = roots.values) {
        values.push(clone(roots, node, value, requested));
    }
}

function on_link(roots, nodes, key) {
    
    var parent = nodes[0];
    var node   = nodes[0] = parent[key];
    var type = node && node.$type || undefined;
    
    if(!!type || is_primitive(node)) {
        
        var root = roots[0];
        var parent = parents[0];
        
        node = replace_node(parent, node, {}, key, roots.lru);
        node = graph_node(root, parent, node, key, 0);
        node = update_back_refs(node, roots.version);
        nodes[0] = node;
    }
}