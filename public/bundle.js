
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    let running = false;
    function run_tasks() {
        tasks.forEach(task => {
            if (!task[0](now())) {
                tasks.delete(task);
                task[1]();
            }
        });
        running = tasks.size > 0;
        if (running)
            raf(run_tasks);
    }
    function loop(fn) {
        let task;
        if (!running) {
            running = true;
            raf(run_tasks);
        }
        return {
            promise: new Promise(fulfil => {
                tasks.add(task = [fn, fulfil]);
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let stylesheet;
    let active = 0;
    let current_rules = {};
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        if (!current_rules[name]) {
            if (!stylesheet) {
                const style = element('style');
                document.head.appendChild(style);
                stylesheet = style.sheet;
            }
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        node.style.animation = (node.style.animation || '')
            .split(', ')
            .filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        )
            .join(', ');
        if (name && !--active)
            clear_rules();
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            let i = stylesheet.cssRules.length;
            while (i--)
                stylesheet.deleteRule(i);
            current_rules = {};
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_update);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }

    const globals = (typeof window !== 'undefined' ? window : global);
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, ret, value = ret) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
                return ret;
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_update);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, detail));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    function cubicInOut(t) {
        return t < 0.5 ? 4.0 * t * t * t : 0.5 * Math.pow(2.0 * t - 2.0, 3.0) + 1.0;
    }
    function quintOut(t) {
        return --t * t * t * t * t + 1;
    }

    function draw(node, { delay = 0, speed, duration, easing = cubicInOut }) {
        const len = node.getTotalLength();
        if (duration === undefined) {
            if (speed === undefined) {
                duration = 800;
            }
            else {
                duration = len / speed;
            }
        }
        else if (typeof duration === 'function') {
            duration = duration(len);
        }
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `stroke-dasharray: ${t * len} ${u * len}`
        };
    }

    /* src/NavBar.svelte generated by Svelte v3.12.1 */

    const file = "src/NavBar.svelte";

    // (39:2) {#if visible}
    function create_if_block(ctx) {
    	var svg, path0, path0_intro, path1, path1_intro, path2, path2_intro, path3, path3_intro, path4, path4_intro, path5, path5_intro, path6, path6_intro, path7, path7_intro, path8, path8_intro, path9, path9_intro, path10, path10_intro;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			path5 = svg_element("path");
    			path6 = svg_element("path");
    			path7 = svg_element("path");
    			path8 = svg_element("path");
    			path9 = svg_element("path");
    			path10 = svg_element("path");
    			attr_dev(path0, "class", "w");
    			attr_dev(path0, "d", "M2 160.001V2.375H72V160.001L36.7407 86.675L2 160.001Z");
    			attr_dev(path0, "stroke", "#E01E41");
    			attr_dev(path0, "stroke-width", "4");
    			add_location(path0, file, 40, 4, 690);
    			attr_dev(path1, "class", "a1");
    			attr_dev(path1, "d", "M92 160.001L125.25 2.375L162 160.001H92Z");
    			attr_dev(path1, "stroke", "#E01E41");
    			attr_dev(path1, "stroke-width", "4");
    			add_location(path1, file, 41, 4, 863);
    			attr_dev(path2, "class", "d");
    			attr_dev(path2, "d", "M182 2.37497V160.001C182 160.001 252 171.474 252 81.6865C252 -8.10056 182 2.37497 182 2.37497Z");
    			attr_dev(path2, "stroke", "#E01E41");
    			attr_dev(path2, "stroke-width", "4");
    			add_location(path2, file, 42, 4, 1024);
    			attr_dev(path3, "class", "e");
    			attr_dev(path3, "d", "M342 160.001H272V81.188M272 81.188V2.375H342L272 81.188ZM272 81.188H342");
    			attr_dev(path3, "stroke", "#E01E41");
    			attr_dev(path3, "stroke-width", "4");
    			add_location(path3, file, 43, 4, 1238);
    			attr_dev(path4, "class", "s");
    			attr_dev(path4, "d", "M449.477 2C449.477 2 414 17.2164 414 45.45C414 79.2995 465.466 76.0006 465.466 114.081C465.466 152.162 428.491 160 428.491 160M473.046 160V154.182H479V160H473.046Z");
    			attr_dev(path4, "stroke", "#E01E41");
    			attr_dev(path4, "stroke-width", "4");
    			add_location(path4, file, 44, 4, 1429);
    			attr_dev(path5, "class", "m");
    			attr_dev(path5, "d", "M621 4.13416V159.02H551V4.13416L586.259 76.1853L621 4.13416Z");
    			attr_dev(path5, "stroke", "#E01E41");
    			attr_dev(path5, "stroke-width", "4");
    			add_location(path5, file, 45, 4, 1713);
    			attr_dev(path6, "class", "a2");
    			attr_dev(path6, "d", "M641 160L674.25 5.11475L711 160H641Z");
    			attr_dev(path6, "stroke", "#E01E41");
    			attr_dev(path6, "stroke-width", "4");
    			add_location(path6, file, 46, 4, 1893);
    			attr_dev(path7, "class", "r");
    			attr_dev(path7, "d", "M731 4.13443V159.02H800.947L777.5 75.6953C777.5 75.6953 799 74.715 799 32.5628C799 -9.58949 731 4.13443 731 4.13443Z");
    			attr_dev(path7, "stroke", "#E01E41");
    			attr_dev(path7, "stroke-width", "4");
    			add_location(path7, file, 47, 4, 2050);
    			attr_dev(path8, "class", "t");
    			attr_dev(path8, "d", "M856 160V3.15381M856 3.15381H821M856 3.15381H891");
    			attr_dev(path8, "stroke", "#E01E41");
    			attr_dev(path8, "stroke-width", "4");
    			add_location(path8, file, 48, 4, 2286);
    			attr_dev(path9, "class", "i");
    			attr_dev(path9, "d", "M910 2.17383V159.02");
    			attr_dev(path9, "stroke", "#E01E41");
    			attr_dev(path9, "stroke-width", "4");
    			add_location(path9, file, 49, 4, 2454);
    			attr_dev(path10, "class", "n");
    			attr_dev(path10, "d", "M1015 159.02L945 2.17383V159.02H1015ZM1015 159.02V2.17383");
    			attr_dev(path10, "stroke", "#E01E41");
    			attr_dev(path10, "stroke-width", "4");
    			add_location(path10, file, 50, 4, 2593);
    			attr_dev(svg, "class", "myName svelte-b6l9di");
    			attr_dev(svg, "viewBox", "0 0 1017 163");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			add_location(svg, file, 39, 1, 595);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    			append_dev(svg, path2);
    			append_dev(svg, path3);
    			append_dev(svg, path4);
    			append_dev(svg, path5);
    			append_dev(svg, path6);
    			append_dev(svg, path7);
    			append_dev(svg, path8);
    			append_dev(svg, path9);
    			append_dev(svg, path10);
    		},

    		i: function intro(local) {
    			if (!path0_intro) {
    				add_render_callback(() => {
    					path0_intro = create_in_transition(path0, draw, {duration: 800, delay: 5100, easing: quintOut});
    					path0_intro.start();
    				});
    			}

    			if (!path1_intro) {
    				add_render_callback(() => {
    					path1_intro = create_in_transition(path1, draw, {duration: 800, delay: 5400, easing: quintOut});
    					path1_intro.start();
    				});
    			}

    			if (!path2_intro) {
    				add_render_callback(() => {
    					path2_intro = create_in_transition(path2, draw, {duration: 800, delay: 5700, easing: quintOut});
    					path2_intro.start();
    				});
    			}

    			if (!path3_intro) {
    				add_render_callback(() => {
    					path3_intro = create_in_transition(path3, draw, {duration: 800, delay: 6000, easing: quintOut});
    					path3_intro.start();
    				});
    			}

    			if (!path4_intro) {
    				add_render_callback(() => {
    					path4_intro = create_in_transition(path4, draw, {duration: 800, delay: 6300, easing: quintOut});
    					path4_intro.start();
    				});
    			}

    			if (!path5_intro) {
    				add_render_callback(() => {
    					path5_intro = create_in_transition(path5, draw, {duration: 800, delay: 6600, easing: quintOut});
    					path5_intro.start();
    				});
    			}

    			if (!path6_intro) {
    				add_render_callback(() => {
    					path6_intro = create_in_transition(path6, draw, {duration: 800, delay: 6900, easing: quintOut});
    					path6_intro.start();
    				});
    			}

    			if (!path7_intro) {
    				add_render_callback(() => {
    					path7_intro = create_in_transition(path7, draw, {duration: 800, delay: 7200, easing: quintOut});
    					path7_intro.start();
    				});
    			}

    			if (!path8_intro) {
    				add_render_callback(() => {
    					path8_intro = create_in_transition(path8, draw, {duration: 800, delay: 7500, easing: quintOut});
    					path8_intro.start();
    				});
    			}

    			if (!path9_intro) {
    				add_render_callback(() => {
    					path9_intro = create_in_transition(path9, draw, {duration: 800, delay: 7800, easing: quintOut});
    					path9_intro.start();
    				});
    			}

    			if (!path10_intro) {
    				add_render_callback(() => {
    					path10_intro = create_in_transition(path10, draw, {duration: 800, delay: 8100, easing: quintOut});
    					path10_intro.start();
    				});
    			}
    		},

    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(svg);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block.name, type: "if", source: "(39:2) {#if visible}", ctx });
    	return block;
    }

    function create_fragment(ctx) {
    	var div, t, img;

    	var if_block = (ctx.visible) && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block) if_block.c();
    			t = space();
    			img = element("img");
    			attr_dev(img, "class", "logo svelte-b6l9di");
    			attr_dev(img, "src", "./images/wsm.svg");
    			attr_dev(img, "alt", "logo");
    			add_location(img, file, 54, 1, 2787);
    			attr_dev(div, "class", "navbar svelte-b6l9di");
    			add_location(div, file, 37, 0, 557);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    			append_dev(div, t);
    			append_dev(div, img);
    		},

    		p: function update(changed, ctx) {
    			if (ctx.visible) {
    				if (!if_block) {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div, t);
    				} else transition_in(if_block, 1);
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},

    		i: function intro(local) {
    			transition_in(if_block);
    		},

    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}

    			if (if_block) if_block.d();
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment.name, type: "component", source: "", ctx });
    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	

      let visible = false;

      onMount(() => {
        $$invalidate('visible', visible = true);
      });

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ('visible' in $$props) $$invalidate('visible', visible = $$props.visible);
    	};

    	return { visible };
    }

    class NavBar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "NavBar", options, id: create_fragment.name });
    	}
    }

    /* src/BeatingHeart.svelte generated by Svelte v3.12.1 */

    const file$1 = "src/BeatingHeart.svelte";

    function create_fragment$1(ctx) {
    	var div1, div0, svg, g2, g0, path0, path1, path2, path3, path4, path5, path6, path7, path8, g1, path9, ellipse0, path10, path11, path12, path13, path14, path15, path16, path17, path18, path19, path20, path21, ellipse1, path22;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			svg = svg_element("svg");
    			g2 = svg_element("g");
    			g0 = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			path5 = svg_element("path");
    			path6 = svg_element("path");
    			path7 = svg_element("path");
    			path8 = svg_element("path");
    			g1 = svg_element("g");
    			path9 = svg_element("path");
    			ellipse0 = svg_element("ellipse");
    			path10 = svg_element("path");
    			path11 = svg_element("path");
    			path12 = svg_element("path");
    			path13 = svg_element("path");
    			path14 = svg_element("path");
    			path15 = svg_element("path");
    			path16 = svg_element("path");
    			path17 = svg_element("path");
    			path18 = svg_element("path");
    			path19 = svg_element("path");
    			path20 = svg_element("path");
    			path21 = svg_element("path");
    			ellipse1 = svg_element("ellipse");
    			path22 = svg_element("path");
    			attr_dev(path0, "id", "Vector 3");
    			attr_dev(path0, "d", "M181     341C181.596 340.837 181.096 339.967 181.5 339.5C182.151 338.746 183.375 339.775 184 339C184.957 337.813 182.6 337.057 181.5 336C180.598 335.134 180.034 333.297 179 334C178.018 334.668 179.265 335.836 179.5 337C179.818 338.578 178.9 340.817 180.5 341C180.694 341.022 180.812 341.051 181 341Z");
    			attr_dev(path0, "fill", "#E3193D");
    			add_location(path0, file$1, 49, 6, 829);
    			attr_dev(path1, "id", "Vector 3_2");
    			attr_dev(path1, "d", "M163.5 377C163.975 377.938 165.047 378.602 164.5 379.5C163.819 380.619 162.426 378.926 161.5 378C160.574 377.074 160.468 376.223 160 375C159.424 373.496 157.488 371.555 159 371C160.432 370.475 160.59 372.776 161.5 374C162.34 375.13 162.863 375.744 163.5 377Z");
    			attr_dev(path1, "fill", "#E3193D");
    			add_location(path1, file$1, 50, 0, 1170);
    			attr_dev(path2, "id", "Vector 3_3");
    			attr_dev(path2, "d", "M153.5 359C152.801 359.349 153.321 360.24 153.5 361C153.849 362.484 156.556 365.42 156 364C155.841 363.593 155.686 363.395 155.5 363C155.053 362.048 154.642 361.542 154.5 360.5C154.421 359.92 154.987 359.325 154.5 359C154.175 358.783 153.849 358.825 153.5 359Z");
    			attr_dev(path2, "fill", "#E3193D");
    			add_location(path2, file$1, 51, 0, 1472);
    			attr_dev(path3, "id", "Vector 3_4");
    			attr_dev(path3, "d", "M150.5 351.5C150.891 351.5 151.116 351.43 151.5 351.5C153.613 351.884 152.044 354.922 151.5 357C151.234 358.017 151.443 359.964 150.5 359.5C149.778 359.145 150.146 358.292 150 357.5C149.575 355.196 147.665 351.695 150 351.5C150.195 351.484 150.305 351.5 150.5 351.5Z");
    			attr_dev(path3, "fill", "#E3193D");
    			add_location(path3, file$1, 52, 0, 1776);
    			attr_dev(path4, "id", "Vector 3_5");
    			attr_dev(path4, "d", "M149.5 367C149.5 367 148.509 372.036 150.5 372C152.523 371.964 152.523 366.855 150.5 366.819C150.103 366.811 149.5 367 149.5 367Z");
    			attr_dev(path4, "fill", "#E3193D");
    			add_location(path4, file$1, 53, 0, 2086);
    			attr_dev(path5, "id", "Vector 3_6");
    			attr_dev(path5, "d", "M152.5 381.5C153.281 382.476 155.203 382.966 154.5 384C153.832 384.982 152.661 383.751 151.5 383.5C150.713 383.33 149.5 383 149.5 383C148.719 382.805 148.256 382.776 147.5 382.5C146.68 382.201 146.352 381.689 145.5 381.5C144.738 381.331 144.262 381.669 143.5 381.5C142.648 381.311 142.358 380.661 141.5 380.5C140.924 380.392 140 380.5 140 380.5V379V377.5L139 376.5C138.769 375.962 139 375 139 375V373.5C139.073 372.507 139.5 371 139.5 371L140.5 369.5C141 368.595 141.18 368.022 141.485 367.049L141.5 367C141.741 366.232 141.759 365.768 142 365C142.314 363.997 142.491 363.42 143 362.5C143.341 361.884 144 361 144 361L145 361.5C146.066 362.261 146.078 363.26 146.5 364.5C146.759 365.262 146.805 365.719 147 366.5C147.195 367.281 147.403 367.701 147.5 368.5C147.594 369.275 147.423 369.723 147.5 370.5C147.64 371.915 148.03 372.658 148.5 374C148.848 374.992 149.109 375.524 149.5 376.5C149.891 377.476 149.982 378.085 150.5 379C151.116 380.088 151.719 380.524 152.5 381.5Z");
    			attr_dev(path5, "fill", "#E3193D");
    			add_location(path5, file$1, 54, 0, 2259);
    			attr_dev(path6, "id", "Vector 3_7");
    			attr_dev(path6, "d", "M120 368.5C119.134 367.598 117.565 367.172 118 366C118.476 364.719 120.133 366 121.5 366C122.476 366 123.054 366.241 124 366C125.103 365.719 125.417 364.851 126.5 364.5C127.986 364.018 128.938 364.5 130.5 364.5H134V366C133.738 367.223 132.503 367.355 132 368.5C131.214 370.288 132 371.547 132 373.5C132 375.062 133.431 376.874 132 377.5C130.603 378.111 130.253 375.869 129 375C128.064 374.351 127.457 374.117 126.5 373.5C125.088 372.59 124.328 372.029 123 371C121.795 370.066 121.057 369.6 120 368.5Z");
    			attr_dev(path6, "fill", "#E3193D");
    			add_location(path6, file$1, 55, 0, 3273);
    			attr_dev(path7, "id", "Vector 3_8");
    			attr_dev(path7, "d", "M40 219.5C40.718 219.003 41.1298 218.573 42 218.5C42.1946 218.484 42.5 218.5 42.5 218.5C42.9142 218.638 42.8851 219.079 43 219.5C43.1541 220.065 43 220.414 43 221C43 221.586 42.8683 221.929 43 222.5C43.3105 223.845 44.6594 223.905 45.5 225C45.9286 225.559 46.1962 225.865 46.5 226.5C46.7664 227.057 46.6685 227.479 47 228C47.2965 228.466 47.5341 228.703 48 229C48.5209 229.332 48.9142 229.305 49.5 229.5L51 230L52.5 231.5C52.5 231.5 52.1986 232.498 52.5 233C52.5 233 52.7791 233.334 53 233.5C53.494 233.87 53.9043 234.162 54.5 234C55.0328 233.855 55.253 233.494 55.5 233C55.8493 232.301 55.5 231.781 55.5 231C55.5 230.609 55.5976 230.378 55.5 230C55.256 229.055 54.2811 229.086 53.5 228.5C52.719 227.914 52.1741 227.706 51.5 227C50.2941 225.737 50.1717 224.612 49.5 223C48.7875 221.29 48.2715 220.332 48 218.5C47.7711 216.955 47.6422 216.021 48 214.5C48.1414 213.899 48.2382 213.559 48.5 213C49.0302 211.868 49.8448 211.565 50.5 210.5C51.2793 209.233 51.6055 208.434 52 207C52.3663 205.669 52.0683 204.811 52.5 203.5C52.9923 202.005 53.6698 201.338 54.5 200L54.5524 199.916C55.2625 198.771 55.6781 198.102 56.5 197C57.5764 195.557 58.2271 194.773 59.5 193.5C60.773 192.227 61.7449 191.791 63 190.5C64.0633 189.407 64.7844 188.847 65.5 187.5C66.0795 186.409 66.0725 185.659 66.5 184.5C66.864 183.513 67.0216 182.936 67.5 182C68.3884 180.261 69.0552 179.313 70.5 178C71.2224 177.343 71.6273 176.938 72.5 176.5C74.2541 175.62 75.6039 176.506 77.5 176C79.3582 175.505 80.1105 174.358 82 174C83.5348 173.709 84.4545 174.227 86 174C87.4065 173.794 88.1456 173.432 89.5 173C90.0883 172.812 90.4237 172.722 91 172.5C92.2226 172.03 92.7018 171.174 94 171C95.1772 170.842 95.8156 171.412 97 171.5C97.9736 171.573 98.8096 170.81 99.5 171.5C99.8087 171.809 99.7834 172.121 100 172.5C100.484 173.348 100.991 173.667 101.5 174.5C101.955 175.245 102.045 175.754 102.5 176.5C103.294 177.802 103.885 178.274 105 179.5C106.115 180.726 106.678 181.502 108 182.5L108.044 182.533C108.579 182.937 108.896 183.176 109.5 183.5C110.589 184.083 111.299 184.212 112.5 184.5C114.031 184.867 114.928 184.917 116.5 185C117.67 185.062 118.335 184.875 119.5 185C120.49 185.106 121.16 184.966 122 185.5C122.824 186.024 122.899 186.731 123.5 187.5C124.439 188.701 125.09 189.276 126 190.5C126.84 191.63 127.71 192.122 128 193.5C128.161 194.264 127.96 194.72 128 195.5C128.071 196.879 128.642 197.627 128.5 199C128.417 199.801 128.117 200.203 128 201C127.83 202.159 128.234 202.852 128 204C127.79 205.03 127.447 205.548 127 206.5C126.814 206.895 126.681 207.103 126.5 207.5C125.989 208.624 126.505 209.782 125.5 210.5C124.998 210.859 124.557 210.734 124 211C123.365 211.304 123.086 211.609 122.5 212C121.914 212.391 121.498 212.502 121 213C120.502 213.498 120.391 213.914 120 214.5C119.609 215.086 119.332 215.379 119 216C118.417 217.089 118.47 217.858 118 219C117.501 220.211 117.373 221.024 116.5 222C115.849 222.728 115.225 222.846 114.5 223.5C114.09 223.87 113.718 223.992 113.5 224.5C113.269 225.038 113.199 225.498 113.5 226C113.642 226.237 113.763 226.358 114 226.5C114.502 226.801 114.962 226.731 115.5 226.5C116.008 226.282 116.109 225.891 116.5 225.5C117.086 224.914 117.48 224.645 118 224C118.442 223.452 118.558 223.048 119 222.5C119.52 221.855 120.032 221.684 120.5 221C121.197 219.981 121.164 219.188 121.5 218C121.719 217.225 121.666 216.732 122 216C122.292 215.36 122.502 214.998 123 214.5C123.498 214.002 123.886 213.844 124.5 213.5C124.881 213.286 125.072 212.914 125.5 213C126.105 213.121 125.904 213.89 126 214.5C126.091 215.079 125.94 215.417 126 216C126.083 216.801 126.321 217.215 126.5 218C126.721 218.971 126.456 219.666 127 220.5C127.302 220.963 127.732 221.017 128 221.5C128.474 222.353 128.095 223.028 128 224C127.903 224.991 127.532 225.505 127.5 226.5C127.494 226.695 127.515 226.805 127.5 227C127.453 227.616 127.096 227.89 127 228.5C126.909 229.079 127 229.414 127 230C127 230.781 126.651 231.301 127 232C127.247 232.494 127.703 232.534 128 233C128.332 233.521 128.257 233.932 128.5 234.5C128.672 234.901 128.691 235.191 129 235.5C129.309 235.809 129.579 235.885 130 236C130.565 236.154 131.031 236.351 131.5 236C131.849 235.738 132 235.437 132 235C132 234.563 131.717 234.379 131.5 234C131.016 233.152 130.231 232.949 130 232C129.862 231.431 130.02 231.085 130 230.5C129.947 228.927 129.311 228.063 129.5 226.5C129.597 225.701 129.258 224.812 130 224.5C130.36 224.348 130.63 224.377 131 224.5C131.524 224.675 131.609 225.109 132 225.5C132.391 225.891 132.686 226.046 133 226.5C133.249 226.859 133.305 227.109 133.5 227.5C133.695 227.891 133.732 228.155 134 228.5L134.033 228.542C134.451 229.081 134.816 229.55 135.5 229.5C135.935 229.468 136.191 229.309 136.5 229C136.937 228.563 137.062 228.114 137 227.5C136.929 226.8 136.391 226.586 136 226C135.609 225.414 135.498 224.998 135 224.5C134.502 224.002 134.048 223.942 133.5 223.5C132.855 222.98 132.719 222.411 132 222C131.464 221.694 130.994 221.87 130.5 221.5C129.801 220.976 129.829 220.309 129.5 219.5C128.892 218.009 128.705 217.097 128.5 215.5C128.276 213.757 128.5 212.757 128.5 211C128.5 210.414 128.346 210.065 128.5 209.5C128.685 208.821 129.122 208.594 129.5 208C130.345 206.672 130.875 205.945 131.5 204.5C131.991 203.367 132.204 202.699 132.5 201.5C132.785 200.347 132.889 199.683 133 198.5C133.146 196.945 133 196.062 133 194.5C133 193.719 132.375 192.969 133 192.5C133.469 192.149 133.914 192.5 134.5 192.5C135.086 192.5 135.416 192.457 136 192.5C136.993 192.573 137.561 192.669 138.5 193C139.323 193.291 139.822 193.449 140.5 194C141.258 194.616 141.285 195.335 142 196C142.834 196.775 143.433 197.102 144.5 197.5C145.433 197.848 146.094 197.588 147 198C147.641 198.291 148.002 198.502 148.5 199C148.998 199.498 148.864 200.199 149.5 200.5C150.029 200.751 150.586 200.914 151 200.5C151.414 200.086 151 199.586 151 199C151 198.219 151.14 197.768 151 197C150.89 196.392 150.969 195.902 150.5 195.5C149.907 194.992 149.281 195.5 148.5 195.5C147.914 195.5 147.565 195.654 147 195.5C146.321 195.315 146.114 194.844 145.5 194.5C145.119 194.286 144.901 194.172 144.5 194C143.932 193.757 143.437 193.937 143 193.5C142.691 193.191 142.595 192.926 142.5 192.5C142.415 192.119 142.377 191.87 142.5 191.5C142.776 190.672 143.738 190.927 144.5 190.5C145.728 189.811 146.308 189.25 147.5 188.5C148.464 187.894 149.041 187.614 150 187C150.593 186.62 150.821 186.185 151.5 186C152.051 185.85 152.403 185.906 152.956 185.993L153 186C153.61 186.096 154.149 185.992 154.5 186.5C154.833 186.982 154.5 187.414 154.5 188C154.5 189.562 154.382 190.442 154.5 192C154.604 193.377 154.74 194.144 155 195.5C155.303 197.081 155.561 197.951 156 199.5C157.078 203.304 158.163 205.279 159.5 209C160.899 212.894 161.987 214.988 163 219C163.825 222.268 164.171 224.145 164.5 227.5C164.92 231.775 164.5 234.204 164.5 238.5C164.5 240.257 164.559 241.244 164.5 243C164.375 246.728 164.541 248.918 163.5 252.5C162.598 255.604 162.001 257.462 160 260C159 261.268 158.289 261.884 157.094 262.918L157 263C155.198 264.561 154.044 265.273 152 266.5C149.754 267.848 148.533 268.832 146 269.5C144.856 269.802 144.186 269.873 143.013 269.999L143 270C140.864 270.228 139.648 270 137.5 270H135C134.219 270 133.762 269.831 133 270C132.148 270.189 131.745 270.545 131 271C130.167 271.509 129.798 271.937 129 272.5C127.494 273.561 126.445 273.857 125 275C123.484 276.199 123.061 277.359 121.5 278.5C120.581 279.172 119.994 279.444 119 280C117.476 280.853 116.635 281.387 115 282C114.422 282.217 114.068 282.257 113.5 282.5C113.099 282.672 112.717 282.621 112.5 283C112.306 283.339 112.415 283.619 112.5 284C112.595 284.426 112.651 284.738 113 285C113.469 285.351 113.916 285.043 114.5 285C115.493 284.927 116.053 284.806 117 284.5C118.247 284.098 118.818 283.564 120 283C121.736 282.172 122.837 281.966 124.5 281C125.953 280.157 126.633 279.476 128 278.5C129.367 277.524 130.164 277.019 131.5 276C132.494 275.242 132.827 274.432 134 274C135.283 273.527 136.137 274.096 137.5 274C138.877 273.903 139.624 273.619 141 273.5C143.14 273.315 146.116 271.387 146.5 273.5C146.57 273.884 146.532 274.111 146.5 274.5C146.377 275.982 145.586 276.633 145 278C144.414 279.367 144.066 280.125 143.5 281.5C143.1 282.472 143.012 283.082 142.5 284C141.781 285.29 141.141 285.904 140.103 286.901L140 287C139.098 287.866 138.528 288.288 137.5 289C136.206 289.897 135.437 290.358 134 291C132.139 291.831 130.93 291.842 129 292.5L128.794 292.57C127.341 293.065 126.462 293.364 125 294C123.398 294.696 122.586 295.269 121 296C119.649 296.622 118.806 296.788 117.5 297.5C116.264 298.174 115.692 298.75 114.5 299.5C113.536 300.106 112.896 300.298 112 301C111.131 301.681 110.908 302.371 110 303C109.282 303.497 108.718 303.503 108 304C107.092 304.629 106.781 305.219 106 306C105.609 306.391 105.314 306.546 105 307C104.751 307.359 104.467 307.565 104.5 308C104.542 308.551 104.992 308.782 105.5 309C106.038 309.231 106.431 309.138 107 309C107.949 308.769 108.192 308.048 109 307.5C109.942 306.861 110.536 306.606 111.5 306C112.692 305.25 113.451 304.939 114.5 304C114.912 303.632 115.064 303.339 115.5 303C116.189 302.464 117.109 301.219 117.5 302C117.675 302.349 117.675 302.651 117.5 303C117.377 303.247 117.17 303.282 117 303.5C116.732 303.845 116.768 304.155 116.5 304.5C116.33 304.718 116.195 304.805 116 305C115.609 305.391 115.454 305.686 115 306C114.641 306.249 114.391 306.305 114 306.5C113.609 306.695 113.217 306.621 113 307C112.806 307.339 113 307.609 113 308C113 308.781 113.433 309.35 113 310C112.847 310.23 112.5 310.5 112.5 310.5C112.5 310.5 112.268 311.155 112 311.5C111.83 311.718 111.5 312 112 312.5C112.5 313 112.253 312.877 112.5 313C113.052 313.276 113.506 312.87 114 312.5C114.221 312.334 114.33 312.218 114.5 312C114.768 311.655 114.885 311.421 115 311C115.154 310.435 114.909 310.079 115 309.5C115.096 308.89 115.13 308.494 115.5 308C115.666 307.779 115.779 307.666 116 307.5C116.494 307.13 116.943 307.266 117.5 307C118.135 306.696 118.568 306.556 119 306C119.611 305.214 119.23 304.458 119.5 303.5C119.667 302.906 119.711 302.546 120 302C120.517 301.024 121.068 300.593 122 300C123.042 299.337 123.841 299.428 125 299C125.987 298.636 126.478 298.249 127.5 298C129.208 297.585 130.243 298 132 298C132.781 298 133.379 297.527 134 298C134.64 298.488 134.462 299.196 134.5 300C134.547 300.995 134.195 301.524 134 302.5C133.805 303.476 133.831 304.061 133.5 305C133.209 305.823 132.861 306.205 132.5 307C132.066 307.958 131.891 308.524 131.5 309.5L130.5 312C130.109 312.976 129.9 313.528 129.5 314.5C128.934 315.875 128.636 316.656 128 318C127.627 318.789 127.391 319.219 127 320C126.609 320.781 126.299 321.18 126 322C125.724 322.756 125.325 323.214 125.5 324L125.512 324.054C125.6 324.453 125.666 324.749 126 325C126.469 325.351 126.962 325.231 127.5 325C128.008 324.782 128.161 324.436 128.5 324C129.036 323.311 129.139 322.795 129.5 322C129.934 321.042 130.066 320.458 130.5 319.5C130.861 318.705 131.043 318.244 131.5 317.5C132.154 316.434 132.71 315.969 133.5 315C134.463 313.818 135.061 313.201 136 312C136.601 311.231 136.991 310.833 137.5 310C137.955 309.255 138.139 308.795 138.5 308C138.934 307.042 139.234 306.517 139.5 305.5C140.044 303.422 139.5 300 139.5 300V296.5C139.5 296.5 139.346 295.565 139.5 295C139.615 294.579 139.751 294.359 140 294C140.314 293.546 140.63 293.41 141 293C141.654 292.275 141.742 291.616 142.5 291C143.178 290.449 143.811 290.536 144.5 290C145.611 289.136 145.826 288.236 146.5 287C147.212 285.694 147.378 284.851 148 283.5C148.731 281.914 149.089 280.99 150 279.5C151.018 277.834 151.703 276.959 153 275.5C153.917 274.468 154.55 274.002 155.5 273C156.928 271.494 157.426 270.353 159 269C159.74 268.364 160.034 267.362 161 267.5C161.967 267.638 161.991 268.667 162.5 269.5C162.955 270.245 163.139 270.705 163.5 271.5C163.934 272.458 164.212 272.989 164.5 274C164.878 275.328 164.713 276.149 165 277.5C165.295 278.891 165.631 279.627 166 281L166.044 281.163C166.435 282.618 166.668 283.483 167 285C167.213 285.973 167.403 286.509 167.5 287.5C167.595 288.472 167.5 289.024 167.5 290C167.5 291.172 167.67 291.841 167.5 293C167.383 293.797 167.205 294.221 167 295C166.639 296.375 166.325 297.116 166 298.5C165.772 299.469 165.606 300.01 165.5 301C165.375 302.165 165.585 302.832 165.5 304C165.357 305.953 165.05 307.047 164.527 308.906L164.5 309C164.166 310.189 163.909 310.835 163.5 312C162.948 313.574 162.523 314.416 162 316C161.301 318.114 161.319 319.43 160.5 321.5C159.857 323.124 159.647 324.183 158.5 325.5C157.679 326.443 156.99 326.736 156 327.5C155.227 328.096 154.725 328.346 154 329C152.868 330.022 152.323 330.716 151.5 332C150.793 333.102 150.586 333.828 150 335C149.219 336.562 148.672 337.388 148 339C147.288 340.71 147.151 341.766 146.5 343.5C146.13 344.484 145.964 345.057 145.5 346C144.997 347.022 144.742 347.636 144 348.5C143.185 349.448 142.356 349.589 141.5 350.5C140.832 351.212 140.568 351.706 140 352.5C139.181 353.645 138.743 354.304 138 355.5C137.17 356.838 137.349 358.188 136 359C134.983 359.613 134.174 359.317 133 359.5C131.636 359.712 130.877 359.903 129.5 360C128.137 360.096 127.358 359.844 126 360C125.011 360.114 124.491 360.403 123.5 360.5C122.528 360.595 121.976 360.5 121 360.5C120.219 360.5 119.75 360.719 119 360.5C118.063 360.226 117.665 359.715 117 359C116.225 358.166 116.043 357.501 115.5 356.5C115.084 355.732 115.036 355.189 114.5 354.5C114.161 354.064 114.008 353.718 113.5 353.5C112.962 353.269 112.325 353.013 112 353.5C111.783 353.825 112 354.109 112 354.5C112 355.086 111.862 355.431 112 356C112.231 356.949 113.087 357.115 113.5 358C114.084 359.251 114 361.5 114 361.5C114 361.5 112.347 358.336 111 356.5C110.098 355.27 109.45 354.693 108.5 353.5C107.284 351.972 106.728 351.018 105.5 349.5C104.195 347.886 103.345 347.081 102 345.5C101.012 344.338 100.488 343.662 99.5 342.5C98.155 340.919 97.2627 340.147 96 338.5C94.7151 336.824 94.1903 335.745 93 334C91.6568 332.031 91.0897 330.776 89.5 329C88.7633 328.177 88.2541 327.807 87.5 327C85.7927 325.173 84.8325 324.116 83.5 322C82.3367 320.153 81.9763 318.953 81 317L78.5 312C76.9379 308.876 76.4115 306.923 74.5 304C73.4314 302.366 72.6189 301.6 71.5 300C70.0412 297.914 69.5842 296.493 68 294.5C66.2817 292.338 64.7224 291.658 63 289.5C61.6826 287.849 61.1716 286.757 60 285C58.4379 282.657 57.3932 281.447 56 279C54.4009 276.191 53.8422 274.44 52.5 271.5C50.9028 268.001 50.0909 266.002 48.5 262.5C47.3436 259.955 46.6716 258.538 45.5 256L42.5 249.5C41.3284 246.962 40.587 245.576 39.5 243C38.4426 240.494 37.5711 239.159 37 236.5C36.6287 234.771 36.5917 233.766 36.5 232C36.419 230.44 36.4033 229.559 36.5 228C36.5974 226.429 36.5679 225.514 37 224C37.2886 222.989 37.4256 222.381 38 221.5C38.6034 220.575 39.0918 220.129 40 219.5Z");
    			attr_dev(path7, "fill", "#E3193D");
    			add_location(path7, file$1, 56, 0, 3817);
    			attr_dev(path8, "id", "Vector 3_9");
    			attr_dev(path8, "d", "M178 232C176.371 230.713 175.983 229.115 174 228.5C169.337 227.055 171.834 236.625 174 241C174.625 242.262 175.147 242.879 176 244C177.839 246.417 179.203 247.513 181.5 249.5C183.715 251.416 185.243 252.134 187.5 254C189.737 255.85 190.144 258.483 193 259C193.961 259.174 194.524 259 195.5 259C196.086 259 196.416 258.957 197 259C197.993 259.073 198.51 259.394 199.5 259.5C200.665 259.625 201.335 259.625 202.5 259.5C203.49 259.394 204.024 259.195 205 259C205.976 258.805 206.542 258.77 207.5 258.5C208.094 258.333 208.392 258.11 209 258C209.768 257.86 210.225 257.906 211 258C211.799 258.097 212.446 257.916 213 258.5C213.301 258.817 213.533 259.065 213.5 259.5C213.458 260.051 213.008 260.282 212.5 260.5C211.962 260.731 211.586 260.5 211 260.5C209.828 260.5 209.148 260.266 208 260.5C206.97 260.71 206.476 261.109 205.5 261.5C204.524 261.891 204.034 262.309 203 262.5C202.04 262.678 201.473 262.575 200.5 262.5C198.705 262.362 196.138 259.705 196 261.5C195.894 262.877 197.582 262.969 198.5 264C199.331 264.934 199.71 265.531 200.5 266.5C201.463 267.682 202.024 268.328 203 269.5C203.976 270.672 204.706 271.198 205.5 272.5C206.275 273.769 205.739 275.211 207 276C207.683 276.427 208.244 276.224 209 276.5C209.82 276.799 210.362 276.904 211 277.5C211.514 277.981 211.609 278.414 212 279C212.391 279.586 212.596 279.923 213 280.5C213.56 281.3 213.991 281.667 214.5 282.5C214.955 283.245 214.904 283.862 215.5 284.5C215.981 285.014 216.337 285.263 217 285.5C217.919 285.828 218.524 285.5 219.5 285.5C219.891 285.5 220.151 285.325 220.5 285.5C221.052 285.776 221.141 286.399 221 287C220.887 287.483 220.665 287.787 220.218 288C219.788 288.204 219.474 288.043 219 288C218.198 287.927 217.781 287.695 217 287.5C216.219 287.305 215.734 287.332 215 287C214.11 286.598 213.69 286.19 213 285.5C212.31 284.81 212.009 284.333 211.5 283.5C211.045 282.755 210.799 282.32 210.5 281.5C210.224 280.744 210.742 279.812 210 279.5C209.64 279.348 209.363 279.355 209 279.5C208.094 279.863 209 281.024 209 282V284C209 284.781 208.762 285.256 209 286C209.215 286.671 209.709 286.859 210 287.5C210.412 288.406 210.251 289.036 210.5 290C210.809 291.196 211.204 291.801 211.5 293C211.785 294.153 211.912 294.816 212 296C212.073 296.974 212 297.524 212 298.5C212 299.672 212.17 300.341 212 301.5C211.883 302.297 211.608 302.702 211.5 303.5C211.369 304.468 211.5 305.024 211.5 306V309.5C211.5 310.086 211.409 310.421 211.5 311C211.596 311.61 212 311.883 212 312.5C212 313.117 212.052 313.724 211.5 314C211.151 314.175 210.849 314.175 210.5 314C210.253 313.877 210.184 313.706 210 313.5L209.948 313.441C209.508 312.951 209.228 312.638 209 312C208.672 311.081 209 310.476 209 309.5C209 308.719 209.051 308.279 209 307.5C208.922 306.315 208.597 305.684 208.5 304.5C208.404 303.332 208.5 302.672 208.5 301.5C208.5 300.328 208.67 299.659 208.5 298.5C208.383 297.703 208.481 297.146 208 296.5C207.58 295.935 206.976 296.018 206.5 295.5C205.789 294.726 205.854 293.99 205.5 293C205.292 292.419 205.195 292.086 205 291.5C204.805 290.914 205.096 290.162 204.5 290C204.312 289.949 204 290 204 290C202.962 290.167 203.354 291.51 203 292.5C202.792 293.081 202.596 293.39 202.5 294C202.409 294.579 202.5 294.914 202.5 295.5V297.5C202.5 298.281 202.27 298.753 202.5 299.5C202.628 299.917 202.751 300.141 203 300.5C203.314 300.954 203.782 300.992 204 301.5C204.231 302.038 204.231 302.462 204 303C203.782 303.508 203.551 303.958 203 304C202.565 304.033 202.391 303.695 202 303.5C201.609 303.305 201.325 303.291 201 303C200.258 302.336 200.695 301.476 200.5 300.5C200.305 299.524 200.106 298.99 200 298C199.875 296.835 199.904 296.168 200 295C200.097 293.816 200.249 293.161 200.5 292C200.67 291.213 200.759 290.768 201 290C201.315 288.997 201.831 288.538 202 287.5C202.126 286.729 201.96 286.28 202 285.5C202.071 284.121 202.714 283.364 202.5 282C202.337 280.961 201.921 280.464 201.5 279.5C200.801 277.899 200.467 276.954 199.5 275.5C198.655 274.23 198.026 273.628 197 272.5C195.885 271.274 195.172 270.672 194 269.5C193.219 268.719 192.728 268.33 192 267.5C190.893 266.237 190.596 265.273 189.5 264C188.599 262.954 188.067 262.376 187 261.5C185.912 260.606 185.092 260.39 184 259.5C182.177 258.015 181.715 256.609 180 255C178.888 253.957 178.347 253.216 177 252.5C175.909 251.921 175.153 251.057 174 251.5C172.777 251.97 172.968 253.277 172.5 254.5C171.924 256.004 171.705 256.903 171.5 258.5C171.279 260.222 171.358 261.224 171.495 262.936L171.5 263C171.61 264.376 171.54 265.198 172 266.5C172.291 267.323 172.609 267.719 173 268.5C174.367 271.234 175.422 272.64 176.5 275.5C177.219 277.408 177.603 278.5 178 280.5C178.496 282.997 178.486 284.454 178.5 287C178.515 289.741 178.605 291.327 178 294C177.495 296.229 176.776 297.35 176 299.5C175.015 302.231 174.435 303.752 173.5 306.5C173.102 307.669 172.97 308.358 172.5 309.5C172.001 310.711 171.633 311.353 171 312.5C170.449 313.497 169.763 313.892 169.5 315C169.181 316.343 169.634 317.169 170 318.5C170.394 319.934 170.808 320.684 171.5 322C172.609 324.11 173.471 325.171 175 327C176.594 328.907 177.593 329.906 179.5 331.5C181.329 333.029 182.857 333.273 184.5 335C185.658 336.217 185.94 337.197 187 338.5C188.742 340.643 189.904 341.702 192 343.5C192.949 344.314 193.303 345.137 194.5 345.5C195.434 345.783 196.028 345.595 197 345.5C197.991 345.403 198.509 345.097 199.5 345C200.472 344.905 201.637 344.094 202 345C202.145 345.363 202 345.609 202 346C202 346.391 202.175 346.651 202 347C201.877 347.247 201.72 347.333 201.5 347.5C200.859 347.987 200.281 347.805 199.5 348C198.719 348.195 198.054 347.916 197.5 348.5C197.2 348.817 197.032 349.065 197 349.5C196.949 350.202 197.696 350.365 198 351C198.266 351.557 198.234 351.943 198.5 352.5C198.921 353.381 199.825 353.539 200 354.5C200.07 354.884 200 355.109 200 355.5C200 356.086 200.414 356.586 200 357C199.586 357.414 199.069 357.138 198.5 357C197.551 356.769 197.19 356.19 196.5 355.5C195.81 354.81 195.274 354.437 195 353.5C194.781 352.75 195.219 352.25 195 351.5C194.726 350.563 194.228 350.151 193.5 349.5C192.975 349.031 192.607 348.857 192 348.5C191.248 348.057 190.752 347.943 190 347.5C189.393 347.143 189.077 346.904 188.5 346.5C187.7 345.94 187.281 345.586 186.5 345C185.719 344.414 185.431 343.205 184.5 343.5C183.368 343.859 184.912 345.316 185 346.5C185.073 347.474 185 348.024 185 349C185 349.781 185.14 350.232 185 351C184.89 351.608 184.61 351.892 184.5 352.5C184.36 353.268 184.5 353.719 184.5 354.5C184.5 355.086 184.346 355.435 184.5 356C184.685 356.679 185.208 356.859 185.5 357.5C185.834 358.232 186 359.5 186 359.5L185.5 360C185.151 360.175 184.888 360.048 184.5 360C183.887 359.923 183.494 359.87 183 359.5C182.301 358.976 182.391 358.281 182 357.5C181.609 356.719 181.289 356.324 181 355.5C180.607 354.379 180.605 353.683 180.5 352.5C180.379 351.138 180.5 350.367 180.5 349C180.5 348.219 180.669 347.762 180.5 347C180.311 346.148 179.844 345.803 179.5 345C179.014 343.865 178.867 343.179 178.5 342C178.078 340.643 177.891 339.867 177.5 338.5C177.109 337.133 177.377 336.118 176.5 335C175.897 334.232 175.245 334.131 174.5 333.5C173.446 332.608 172.976 331.976 172 331C171.219 330.219 170.739 329.821 170 329C169.163 328.071 168.711 327.529 168 326.5C167.353 325.563 167.639 324 166.5 324C165.361 324 165.586 325.524 165 326.5L163.5 329C162.914 329.976 162.543 330.499 162 331.5C161.584 332.268 161.457 332.756 161 333.5C160.346 334.566 159.837 335.071 159 336C158.261 336.821 157.629 337.092 157 338C156.503 338.718 156.257 339.165 156 340C155.541 341.493 156 342.438 156 344V347.5V356.5C156 357.281 155.762 357.756 156 358.5C156.215 359.171 156.62 359.407 157 360C157.614 360.959 157.853 361.563 158.5 362.5C159.211 363.529 159.663 364.071 160.5 365C161.239 365.821 161.994 366.018 162.5 367C162.956 367.885 162.694 368.553 163 369.5C163.402 370.747 164.001 371.289 164.5 372.5C164.97 373.642 165.164 374.312 165.5 375.5C165.719 376.275 165.711 376.749 166 377.5C166.409 378.563 167.253 378.889 167.5 380C167.669 380.762 167.374 381.229 167.5 382C167.669 383.038 168.358 383.458 168.5 384.5C168.579 385.08 168.987 385.675 168.5 386C168.175 386.217 167.882 386.08 167.5 386C166.811 385.855 166.525 385.469 166 385C165.272 384.349 165.19 383.69 164.5 383C163.81 382.31 163.308 382.048 162.5 381.5C161.558 380.861 160.805 380.805 160 380C159.195 379.195 159.139 378.442 158.5 377.5C157.952 376.692 157.469 376.356 157 375.5C156.406 374.417 156.296 373.699 156 372.5C155.715 371.347 155.915 370.613 155.5 369.5C155.102 368.433 154.775 367.834 154 367C153.335 366.285 152.054 364.525 152 365.5C151.961 366.203 152.708 366.359 153 367C153.334 367.732 153.376 368.204 153.5 369C153.71 370.351 153.404 371.137 153.5 372.5C153.597 373.877 153.513 374.708 154 376C154.402 377.065 154.894 377.536 155.5 378.5C156.25 379.692 156.658 380.371 157.5 381.5C158.576 382.943 159.265 383.69 160.5 385C161.258 385.804 161.531 386.47 162.5 387C163.711 387.663 164.624 387.381 166 387.5C168.14 387.685 169.352 387.5 171.5 387.5C173.062 387.5 173.941 387.606 175.5 387.5C178.48 387.298 180.147 386.886 183 386C184.593 385.505 185.426 385.052 187 384.5C188.165 384.091 188.909 384.079 190 383.5C191.347 382.784 191.91 382.067 193 381C196.135 377.93 196.744 375.264 199 371.5C203.447 364.082 205.462 359.649 209.5 352C211.865 347.52 213.105 344.963 215.5 340.5C217.608 336.573 218.998 334.482 221 330.5C223.119 326.284 224.22 323.87 226 319.5C227.259 316.41 227.794 314.611 229 311.5C230.141 308.559 231.151 307.038 232 304C232.217 303.225 232.417 302.801 232.5 302C232.642 300.627 232.417 299.816 232 298.5C231.604 297.251 230.784 296.779 230.5 295.5C230.246 294.356 230.353 293.662 230.5 292.5C230.678 291.09 231.03 290.342 231.5 289C231.848 288.008 232.136 287.487 232.5 286.5C232.928 285.341 233.014 284.635 233.5 283.5C233.844 282.697 234.27 282.342 234.5 281.5C234.808 280.37 234.328 279.659 234.5 278.5C234.745 276.85 235.51 276.095 236 274.5C236.989 271.278 236.904 269.318 237.5 266C237.886 263.851 238.212 262.664 238.5 260.5C238.836 257.976 238.772 256.536 239 254C239.176 252.046 239.522 250.962 239.5 249C239.481 247.232 239.489 246.199 239 244.5C238.709 243.489 238.421 242.964 238 242C237.301 240.399 236.781 239.562 236 238C235.219 236.438 234.956 235.462 234 234C233.466 233.183 233.421 232.325 232.5 232C231.948 231.805 231.583 231.94 231 232C228.468 232.262 227.839 234.494 225.5 235.5C223.455 236.38 222.207 236.71 220 237C217.87 237.28 216.648 237 214.5 237H210.5C208.743 237 207.71 236.595 206 237C204.301 237.403 203.624 238.357 202 239C199.93 239.819 198.709 240.224 196.5 240.5C194.562 240.742 193.401 240.946 191.5 240.5C190.052 240.161 189.316 239.692 188 239C185.89 237.891 184.953 236.867 183 235.5C181.047 234.133 179.87 233.477 178 232Z");
    			attr_dev(path8, "fill", "#E3193D");
    			add_location(path8, file$1, 57, 0, 18449);
    			attr_dev(g0, "id", "ventricle-group");
    			add_location(g0, file$1, 48, 4, 798);
    			attr_dev(path9, "id", "Vector 3_10");
    			attr_dev(path9, "d", "M173 223C171.876 223.385 172.312 226 173.5 226C174.688 226 175.124 223.385 174 223C173.631 222.873 173.369 222.873 173 223Z");
    			attr_dev(path9, "fill", "#E3193D");
    			add_location(path9, file$1, 60, 0, 29158);
    			attr_dev(ellipse0, "id", "Ellipse 2");
    			attr_dev(ellipse0, "cx", "215.757");
    			attr_dev(ellipse0, "cy", "86.2519");
    			attr_dev(ellipse0, "rx", "7");
    			attr_dev(ellipse0, "ry", "13.5977");
    			attr_dev(ellipse0, "transform", "rotate(-23 215.757 86.2519)");
    			attr_dev(ellipse0, "fill", "#E3193D");
    			add_location(ellipse0, file$1, 61, 0, 29326);
    			attr_dev(path10, "id", "Vector 3_11");
    			attr_dev(path10, "d", "M188 235.5C188.061 234.526 189.275 234.654 190 234C190.41 233.63 190.753 233.494 191 233C191.349 232.301 190.612 231.678 191 231C191.433 230.242 192.219 230.391 193 230C193.781 229.609 194.476 229.699 195 229C195.37 228.506 195.257 228.068 195.5 227.5C195.672 227.099 195.691 226.809 196 226.5C196.69 225.81 197.81 225.81 198.5 226.5C199.19 227.19 198.191 228.074 198.5 229C198.809 229.926 199.31 230.31 200 231C200.69 231.69 201.2 231.94 202 232.5C202.577 232.904 202.865 233.196 203.5 233.5C204.057 233.766 205.5 233 205 234C204.5 235 203 235 203 235C203 235 202.107 235.643 201.5 236C200.748 236.443 200.295 236.639 199.5 237C198.542 237.434 198.034 237.809 197 238C196.04 238.178 194.5 238 194.5 238C194.5 238 193.262 238.169 192.5 238C191.648 237.811 191.268 237.416 190.5 237C189.499 236.457 187.929 236.636 188 235.5Z");
    			attr_dev(path10, "fill", "#E3193D");
    			add_location(path10, file$1, 62, 0, 29453);
    			attr_dev(path11, "id", "Vector 3_12");
    			attr_dev(path11, "d", "M45.5 213C44.7189 212.219 42.7189 214.219 43.5 215C44.0523 215.552 44.9477 215.552 45.5 215C46.0523 214.448 46.0523 213.552 45.5 213Z");
    			attr_dev(path11, "fill", "#E3193D");
    			add_location(path11, file$1, 63, 0, 30322);
    			attr_dev(path12, "id", "Vector 3_13");
    			attr_dev(path12, "d", "M176 214.5C176.223 215.249 176.473 215.879 176 216.5C175.512 217.14 174.8 216.911 174 217C173.337 217.074 172.782 216.547 172.293 217C171.717 217.533 172.242 218.259 172.5 219L173 220C173 220 174.491 220.703 175.5 221C176.455 221.281 177.336 220.758 178 221.5C178.291 221.825 178.438 222.068 178.5 222.5C178.587 223.111 178.332 223.479 178 224C177.703 224.466 177.247 224.506 177 225C176.651 225.699 176.651 226.301 177 227C177.247 227.494 177.609 227.609 178 228C179.172 229.172 179.671 230.01 181 231C181.913 231.68 182.541 231.886 183.5 232.5C184.093 232.88 184.329 233.285 185 233.5C185.744 233.738 186.253 233.73 187 233.5C187.417 233.372 187.71 233.326 188 233C188.519 232.416 188 231.781 188 231C188 230.219 187.527 229.621 188 229C188.488 228.36 189.244 228.776 190 228.5C190.82 228.201 191.294 228.014 192 227.5C192.67 227.013 193.549 226.827 193.5 226C193.474 225.564 193.268 225.345 193 225C192.568 224.444 192.039 224.453 191.5 224C191.077 223.645 190.797 223.466 190.5 223C190.168 222.479 190.195 222.086 190 221.5C189.805 220.914 189.937 220.437 189.5 220C189.063 219.563 188.61 219.596 188 219.5C187.421 219.409 187.052 219.695 186.5 219.5C185.579 219.175 185.539 218.314 185 217.5C184.58 216.865 184.291 216.529 184 215.825C183.572 214.789 183.422 214.118 183.5 213C183.556 212.197 183.677 211.738 184 211C184.501 209.855 185.274 209.518 186 208.5C186.409 207.927 186.389 207.349 187 207C187.678 206.612 188.407 206.492 189 207C189.469 207.402 189.5 207.883 189.5 208.5C189.5 209.117 189.306 209.464 189 210C188.589 210.719 188.046 210.877 187.5 211.5C186.856 212.234 186.22 212.549 186 213.5C185.776 214.47 185.889 215.214 186.5 216C186.932 216.556 187.329 216.785 188 217C188.744 217.238 189.219 217 190 217C190.976 217 191.904 216.458 192.5 217C193.096 217.542 192.805 218.219 193 219C193.195 219.781 193.224 220.244 193.5 221C193.799 221.82 193.809 222.466 194.5 223C195.137 223.492 195.701 223.403 196.5 223.5C197.275 223.594 197.721 223.449 198.5 223.5C199.685 223.578 200.735 223.092 201.5 224C202.019 224.616 202 225.195 202 226C202 226.805 201.377 227.204 201.5 228C201.649 228.965 202.31 229.31 203 230C203.69 230.69 204.141 231.036 205 231.5C206.251 232.175 208.023 231.161 208.5 232.5C208.5 232.5 208 233 208.5 234C209 235 210.938 234 212.5 234C214.257 234 215.25 234.16 217 234C219.594 233.763 221.058 233.407 223.5 232.5C225.546 231.74 226.728 231.275 228.5 230C230.293 228.71 231.243 227.816 232.5 226C233.494 224.564 233.921 223.648 234.5 222C235.223 219.94 235.468 218.683 235.5 216.5C235.535 214.125 235.378 212.707 234.5 210.5C233.918 209.037 232.966 208.504 232.5 207C231.864 204.948 232.5 203.648 232.5 201.5C232.5 199.938 232.942 198.998 232.5 197.5C231.835 195.245 230.201 194.623 228.5 193C226.691 191.274 225.704 190.182 223.5 189C221.16 187.745 219.51 187.867 217 187C214.429 186.112 213.064 185.407 210.5 184.5C208.754 183.882 207.692 183.755 206 183C203.921 182.072 202.679 181.538 201 180C199.876 178.97 199.203 178.353 198.5 177C197.845 175.739 198.52 174.49 197.5 173.5C196.613 172.64 195.713 172.732 194.5 172.5C192.774 172.169 191.747 172.311 190 172.5C188.21 172.694 187.139 172.755 185.5 173.5C183.971 174.195 182.629 174.442 182 176C181.561 177.086 181.828 177.841 182 179C182.245 180.65 182.518 181.651 183.5 183C184.398 184.233 186.766 183.998 186.5 185.5C186.377 186.193 186.111 186.651 185.5 187C184.822 187.388 184.281 187 183.5 187H180.5C179.328 187 178.15 186.025 177.5 187C177.067 187.65 177.253 188.259 177.5 189C177.849 190.048 179.5 189.895 179.5 191C179.5 192.105 178.531 192.603 177.5 193C176.589 193.35 175.87 192.556 175 193C173.986 193.517 173.747 194.389 173.5 195.5C173.331 196.262 173.281 196.75 173.5 197.5C173.774 198.437 174.536 198.641 175 199.5C175.675 200.751 176.433 201.646 176 203C175.785 203.671 175.636 204.199 175 204.5C173.971 204.987 173.605 202.724 172.5 203C171.696 203.201 171.411 203.781 171 204.5C170.225 205.856 170.678 206.971 171 208.5C171.306 209.955 171.587 210.826 172.5 212C173.531 213.326 175.52 212.89 176 214.5Z");
    			attr_dev(path12, "fill", "#E3193D");
    			add_location(path12, file$1, 64, 0, 30500);
    			attr_dev(path13, "id", "Vector 3_14");
    			attr_dev(path13, "d", "M157 186.5V190.5L159 190L161.5 190.5L164.5 191.5L166.5 194L168 198L169.5 201L171 200.5L170.5 198.5V196L171 193.5L172 191.5L174 190.5L173.5 189V187.5L174.5 185.5L175.5 184.5L178 184L180.5 183.5L179.5 181V179.5V177V175L180.5 172.5L183 171L185.5 170H189.5H194L197 170.5L199.5 172.5L201.5 175.5L204.5 179.5L207.5 181L214 183.5L222.5 186.5L226.5 188L230 190.5L230.5 189L231.5 185.5L232 176.5V168L231 161L229 155L226.5 149L224.5 144.5V141L226 138L229 136.5L232 137L236 139.5L239.5 143L242 141L243.5 139V137.5L242 135.5L239 134.5V133L240.5 132L245 134L249.5 138.5L252.5 142L256 138.5L257 134L254.5 130.5L251 126L247.5 123L243.5 119.5V117.5L245 116H248.5L253.5 117.5H258L259 115L260 111V107.5L259 101.5H253.5L249.5 100.5L245 99.5L239 100.5L237.5 104L234.5 107.5L232 109.5L229 111L227.5 109.5L229 107.5L232 105.5L234.5 102.5L237.5 98.5L239 94L240.5 90L237.5 87.5L233 86.5L230.5 90L223 100.5L209 109.5L196.5 116L183 124L173 130.5L167 134L161.5 138.5L160 142V147V152L161.5 157.5V162.5V168V173.5L160 178L158 182L157 186.5Z");
    			attr_dev(path13, "fill", "#E3193D");
    			add_location(path13, file$1, 65, 0, 34556);
    			attr_dev(path14, "id", "Vector 3_15");
    			attr_dev(path14, "d", "M101 162L102.5 160.5L101.5 164V165.5L101 167.5V169H98.5H95.5L92.5 170H88.5L85 171L81 172L77.5 173L74 173.5L71 175L68.5 176.5L65.5 178.5L67.5 176L71 173.5L74 172L77.5 171L81 170L85 169L88 168.5H91L94 168L96.5 167.5L98.5 166L100 164L101 162Z");
    			attr_dev(path14, "fill", "#E3193D");
    			add_location(path14, file$1, 66, 0, 35611);
    			attr_dev(path15, "id", "Vector 3_16");
    			attr_dev(path15, "d", "M109.5 130.5C109.5 128.938 108.25 127.437 109.5 126.5C110.605 125.672 111.658 126.676 113 127C114.2 127.29 114.858 127.53 116 128C117.211 128.499 117.866 128.845 119 129.5C120.219 130.204 120.947 130.565 122 131.5C123.14 132.513 123.911 133.093 124.5 134.5C124.958 135.596 125 136.312 125 137.5C125 138.688 124.859 139.368 124.5 140.5C124.104 141.749 123.655 142.366 123 143.5C122.296 144.719 121.834 145.366 121 146.5C120.259 147.507 119.914 148.147 119 149C117.971 149.961 117.331 151.459 116 151C114.924 150.629 114.5 149 114.5 148.5C114.5 148 113.527 147.009 113 146C112.311 144.682 111.979 143.908 111.5 142.5C110.981 140.976 110.958 140.044 110.5 138.5C110.149 137.316 109.742 136.711 109.5 135.5C109.117 133.585 109.5 132.453 109.5 130.5Z");
    			attr_dev(path15, "fill", "#E3193D");
    			add_location(path15, file$1, 67, 0, 35895);
    			attr_dev(path16, "id", "Vector 3_17");
    			attr_dev(path16, "d", "M110 120C109.771 121.545 108.75 123.063 110 124C110.494 124.371 110.914 124.305 111.5 124.5C112.672 124.891 113.304 125.191 114.5 125.5C115.464 125.749 116.045 125.719 117 126C118.009 126.297 118.513 126.636 119.5 127C120.659 127.428 121.458 127.337 122.5 128C123.432 128.593 123.719 129.219 124.5 130C125.476 130.976 126.294 131.313 127 132.5C127.823 133.884 127.819 134.9 128 136.5C128.332 139.436 128.271 141.333 127 144C126.277 145.516 125.452 146.116 124.5 147.5C123.702 148.66 123.455 149.465 122.5 150.5C121.067 152.052 119.893 152.563 118 153.5C116.505 154.24 115.472 154.215 114 155C112.277 155.919 111.449 156.691 110 158C108.255 159.576 107.15 160.449 106 162.5C105.184 163.955 104.745 164.85 104.5 166.5C104.328 167.659 104.336 168.34 104.5 169.5C104.831 171.836 105.694 173.035 107 175C107.997 176.499 108.452 177.581 110 178.5C111.385 179.322 112.407 179.267 114 179.5C116.318 179.839 117.738 180.11 120 179.5C121.015 179.226 121.836 179.316 122.5 178.5C123.363 177.44 122.405 176.364 122.5 175C122.651 172.822 122.892 171.597 123.5 169.5C124.085 167.48 124.513 166.357 125.5 164.5C126.618 162.395 127.397 161.264 129 159.5C130.866 157.446 132.258 156.636 134.5 155C136.206 153.755 136.996 152.668 139 152C141.408 151.197 143.005 151.53 145.5 152C147.32 152.343 149.513 151.713 150 153.5C150.154 154.065 150.154 154.435 150 155C149.435 157.072 146.61 154.6 144.5 155C141.753 155.521 140.369 156.516 138 158C135.648 159.473 134.328 160.412 132.5 162.5C130.823 164.416 130.112 165.71 129 168C128.002 170.056 127.365 171.244 127 173.5C126.688 175.428 126.688 176.573 127 178.5C127.365 180.756 127.667 182.143 129 184C130.549 186.158 131.948 187.266 134.5 188C136.564 188.594 138.529 189.565 140 188C140.838 187.108 140.904 186.247 140.997 185.033L141 185C141.123 183.395 141.33 181.908 140 181C138.871 180.229 137.829 181.321 136.5 181C134.709 180.568 133.75 179.853 132.5 178.5C131.432 177.344 130.718 176.559 130.5 175C130.5 175 130.149 173.969 130.5 173.5C130.969 172.875 131.763 173.24 132.5 173.5C133.828 173.969 133.364 175.668 134.5 176.5C135.647 177.34 136.581 177.415 138 177.5C139.797 177.607 140.891 175.692 142.5 176.5C143.758 177.132 143.805 178.275 144.5 179.5C145.449 181.172 144.607 183.66 146.5 184C148.272 184.318 148.801 182.342 150 181C151.807 178.977 151.712 177.04 153.5 175C155.148 173.119 157.121 173.086 158.5 171C160.976 167.253 158.984 163.965 158.5 159.5C158.244 157.138 157.911 155.84 157.5 153.5C156.95 150.369 155.743 148.668 156 145.5C156.18 143.281 156.569 142.022 157.5 140C158.383 138.081 159.082 137.065 160.5 135.5C161.709 134.166 162.567 133.589 164 132.5C166.027 130.96 167.333 130.337 169.5 129C172.778 126.978 174.703 125.99 178 124C180.552 122.46 181.976 121.586 184.5 120C187.252 118.271 188.698 117.146 191.5 115.5C194.362 113.819 196.17 113.235 199 111.5C201.632 109.887 203.031 108.853 205.5 107C207.5 105.499 208.382 104.329 210.5 103C212.868 101.514 217 100 217 100C217 100 214.027 98.4592 212.5 97C210.777 95.3534 210.213 94.0517 209 92C207.889 90.1208 207.188 89.0717 206.5 87C205.69 84.5628 205.659 83.0634 205.5 80.5C205.391 78.746 205.5 78 205.5 76C205.5 74 201.536 77.8235 199 79C196.068 80.3602 194.41 81.0926 191.5 82.5C188.749 83.8308 187.212 84.5907 184.5 86C181.942 87.3294 180.57 88.194 178 89.5C174.729 91.1619 172.771 91.8381 169.5 93.5C166.93 94.8061 165.487 95.5418 163 97C160.197 98.6438 158.841 99.9212 156 101.5C152.257 103.58 150.129 104.863 146 106C144.08 106.529 142.983 106.816 141 107C139.25 107.162 138.256 107.072 136.5 107C134.345 106.912 133.137 106.79 131 106.5C128.837 106.206 127.608 106.068 125.5 105.5C122.874 104.792 121.416 101.751 119 103C118.019 103.507 117.691 104.138 117 105C116.015 106.228 115.83 107.162 115 108.5C114.257 109.696 113.654 110.253 113 111.5C112.225 112.977 112.058 113.928 111.5 115.5C110.88 117.246 110.271 118.168 110 120Z");
    			attr_dev(path16, "fill", "#E3193D");
    			add_location(path16, file$1, 68, 0, 36685);
    			attr_dev(path17, "id", "Vector 3_18");
    			attr_dev(path17, "d", "M124.5 180.5C123.365 179.976 121.541 181.337 122 182.5C122.321 183.312 123.251 183.052 124 183.5C125.781 184.565 126.511 188.447 128 187C129.442 185.599 126.423 184.286 125.5 182.5C125.099 181.724 125.293 180.866 124.5 180.5Z");
    			attr_dev(path17, "fill", "#E3193D");
    			add_location(path17, file$1, 69, 0, 40570);
    			attr_dev(path18, "id", "Vector 3_19");
    			attr_dev(path18, "d", "M154 183C153.31 182.586 153.583 181.801 153.5 181C153.44 180.417 153.5 179.5 153.5 179.5C153.5 179.5 154.949 176.105 156 177C156.904 177.77 155.597 178.816 155.5 180C155.404 181.168 156.548 182.476 155.5 183C154.976 183.262 154.502 183.301 154 183Z");
    			attr_dev(path18, "fill", "#E3193D");
    			add_location(path18, file$1, 70, 0, 40840);
    			attr_dev(path19, "id", "Vector 3_20");
    			attr_dev(path19, "d", "M39.5 208.5C37.9751 210.279 37.1582 214.578 39.5 214.5C40.6379 214.462 41.1039 213.702 42 213C43.4169 211.889 43.9236 210.943 45 209.5C45.8419 208.371 46.3262 207.736 47 206.5C47.7116 205.194 47.9441 204.379 48.5 203C49.1237 201.453 49.4476 200.574 50 199C50.4089 197.835 50.411 197.085 51 196C51.5963 194.901 52.1687 194.434 53 193.5C53.918 192.469 54.446 191.892 55.5 191C56.2453 190.369 56.7547 190.131 57.5 189.5C58.554 188.608 59.1975 188.124 60 187C60.7613 185.934 61.2431 185.284 61.5 184C61.6915 183.043 62.2773 182.091 61.5 181.5C60.5935 180.811 59.6939 182.097 59 183C58.0406 184.248 59.159 185.57 58.5 187C57.9766 188.135 57.3972 188.629 56.5 189.5C54.872 191.08 53.6079 191.612 51.5229 192.49L51.5 192.5C50.3618 192.979 49.4001 192.654 48.5 193.5C46.9345 194.971 49.3949 197.047 48.5 199C47.9791 200.137 47.483 200.727 46.5 201.5C45.0436 202.645 42.9892 201.434 42 203C41.1659 204.321 42.8869 205.714 42 207C41.3536 207.937 40.241 207.636 39.5 208.5Z");
    			attr_dev(path19, "fill", "#E3193D");
    			add_location(path19, file$1, 71, 0, 41133);
    			attr_dev(path20, "id", "Vector 2");
    			attr_dev(path20, "d", "M43 88C45.2765 85.9145 46.7417 84.8871 49.5 83.5C49.5 83.5 54.3147 81.4935 57.5 80.5C58.8571 80.0768 59.6252 79.8614 61 79.5C61.7786 79.2954 62.6211 78.2896 63 79C63.1838 79.3446 63.9763 78.4379 63 80L60.5 84C60.5 84 59.0143 87.5843 58.5 90C57.8076 93.2523 57.9224 95.1757 58 98.5C58.0825 102.035 58.3272 104.028 59 107.5C59.5767 110.476 59.2267 111.991 61 115C62.7733 118.009 65.5523 118.239 65 121C64.5667 123.166 61.8702 122.97 61 125C60.077 127.154 61 128.657 61 131C61 133.734 61.5 135 61 138C60.5 141 57.775 136.792 57 135C56.38 133.566 57.2331 132.545 57 131C56.6211 128.49 55.5041 127.331 54.5 125C53.2302 122.052 53.4894 119.683 51.1354 117.5C49.6272 116.102 48.5405 114.742 46.5 115C44.8335 115.211 44.1877 114.812 43 116C41.8123 117.188 41 119 40.5 121C40 123 38 127 38 127C38 127 34.3696 131.806 31.5 131C27.7401 129.944 31.5 124.905 31.5 121C31.5 117.095 31.0193 114.876 31.5 111C31.9197 107.616 32.3218 105.7 33.5 102.5C34.7977 98.9754 35.8742 97.0965 38 94C39.7263 91.4855 40.7509 90.0603 43 88Z");
    			attr_dev(path20, "fill", "#E3193D");
    			add_location(path20, file$1, 72, 0, 42140);
    			attr_dev(path21, "id", "Vector");
    			attr_dev(path21, "d", "M6 56C5.53501 58.8653 1.56928 58.6536 1 61.5C0.0793501 66.1033 4.81614 69.6854 9.5 70C13.6098 70.2761 14.7378 66.1771 18.5 64.5C22.2239 62.8399 24.4642 62.0793 28.5 61.5L28.6075 61.4846C32.4092 60.9387 34.7361 60.6047 38.5 61.5C43.3543 62.6547 45.9253 64.5189 49.5 68C52.8369 71.2495 52.0064 75.603 56 78C60.6878 80.8137 66.2418 74.0291 70 78C71.5006 79.5856 71.6848 80.9748 72.5 83C74.4305 87.7959 74.5441 90.8503 75 96C75.396 100.474 75.6215 103.052 75 107.5C74.4691 111.299 74.5268 113.743 72.5 117C70.6749 119.933 66 123 66 123C66 123 58.6877 138.034 63 146C64.4521 148.682 67.1101 149.083 68 152C69.1061 155.626 65.1733 157.8 66 161.5C66.6499 164.409 72 165 70 168C68 171 66 174.5 66 174.5C66 174.5 68.4081 172.927 70 172C75.3628 168.878 78.3809 166.532 84.5 165.5C88.5434 164.818 91.3867 167.439 95 165.5C98.0635 163.856 98.1382 161.051 100.5 158.5C103.982 154.739 109.534 155.034 110.5 150C111.233 146.179 108.094 144.345 107.5 140.5C106.904 136.641 107.5 134.405 107.5 130.5C107.5 127.571 108 126 107.5 123C107 120 110.5 113 110.5 113C110.5 113 111.944 108.244 113.5 105.5C115.955 101.169 118.017 98.9869 122 96C124.519 94.1109 126.105 93.2383 129 92C132.354 90.5654 134.353 89.5947 138 89.5C142.024 89.3955 144.131 90.8897 148 92C152.748 93.3625 152.5 97 160 96C167.5 95 179.5 85 179.5 83C179.5 81 171.736 74.0966 165.5 70C160.097 66.4506 156.736 64.7013 150.5 63C143.883 61.1947 139.838 60.9655 133 61.5C127.426 61.9357 123.084 68.3191 119 64.5C116.473 62.1367 116.779 59.4488 116.5 56C116.114 51.2287 117.18 48.4275 119 44C120.566 40.1902 121.869 38.1696 124.5 35C127.327 31.5935 129.104 29.6024 133 27.5C137.418 25.1158 140.718 26.0295 145.5 24.5C148.678 23.4835 151.502 24.1727 153.5 21.5C156.096 18.0272 155.452 13.1234 152 10.5C149.046 8.25516 142.5 10.5 142.5 10.5V1.00001C142.5 1.00001 139.588 0.247704 138 1.00001C134.647 2.5882 140.987 8.29925 138 10.5C135.799 12.1216 133.158 12.1783 131 10.5C129.889 9.63554 130.2 8.23644 129 7.50001C127.502 6.58088 125.475 6.03779 124.5 7.50001C123.85 8.47481 124.688 9.34354 124.5 10.5C124.151 12.655 123.12 13.6263 122 15.5C118.669 21.0711 114.18 22.153 110.5 27.5C106.487 33.3308 104.866 37.1722 103 44C99.9122 55.3015 104.5 70 105.5 73C106.5 76 106 82 98 70C90 58 92.49 44.204 93 27.5C93.2396 19.6542 99 10 95 7.50001C91 5.00001 83.8268 6.10776 79.5 10.5C74.8088 15.2622 77.9323 20.8293 77.5 27.5C75.9996 50.654 84.5 86.5 84.5 86.5C84.5 86.5 88 106 77.5 81C67 56 46.5 21.5 41.5 22.5C36.5 23.5 30.2601 25.1953 28.5 31C26.4098 37.8936 39.5 44 38.5 46.5C37.5 49 17 54.5 14 50C11 45.5 11.7164 46.7097 9.5 46.5C6.96541 46.2602 4.82336 47.5909 4 50C3.20122 52.3372 6.39565 53.562 6 56Z");
    			attr_dev(path21, "fill", "#E3193D");
    			add_location(path21, file$1, 73, 0, 43192);
    			attr_dev(ellipse1, "id", "Ellipse");
    			attr_dev(ellipse1, "cx", "66.5");
    			attr_dev(ellipse1, "cy", "98.5");
    			attr_dev(ellipse1, "rx", "5.5");
    			attr_dev(ellipse1, "ry", "18.5");
    			attr_dev(ellipse1, "fill", "#E3193D");
    			add_location(ellipse1, file$1, 74, 0, 45871);
    			attr_dev(path22, "id", "Vector 2_2");
    			attr_dev(path22, "d", "M42.5 124.5C43.9266 122.096 42.7737 118.619 45.5 118C48.623 117.291 48.9364 121.705 50.5 124.5C51.7393 126.715 52.5673 127.999 53 130.5C53.3329 132.424 52.1864 133.725 53 135.5C54.0608 137.814 56.7234 137.176 58.5 139C59.6721 140.203 60.738 140.841 61 142.5C61.3405 144.656 58.0342 145.367 58.5 147.5C58.975 149.675 61.6858 149.203 63 151C64.458 152.994 65.1105 154.533 65 157C64.8592 160.145 61 164 61 164C61 164 65 162 65 164C65 166 65.5 167 65 169C64.5 171 62.5 170.5 61 171.5C59.5 172.5 64 174 63 175.5C62 177 60.1233 178.118 58.5 180C57.6834 180.947 56.9004 181.316 56.5 182.5C56.1248 183.61 56.7957 184.366 56.5 185.5C55.9761 187.508 54.6324 188.218 53 189.5C50.5191 191.448 48 192.5 45.5 192.5C43 192.5 45.5 197.5 45.5 197.5C45.5 197.5 45.5 198.5 43 199.5C40.5 200.5 40 197.5 38 199.5C36 201.5 40.9919 202.692 40.5 205C40.0098 207.3 37 208.5 36 209C35 209.5 36 217 36 217C36 217 33.4994 211.975 31.5 209C29.4078 205.887 27.7217 204.522 25.5 201.5C22.9979 198.097 21.3792 196.283 19.5 192.5C17.6593 188.794 16.7062 186.577 16 182.5C15.2668 178.267 16 175.796 16 171.5V160C16 160 17.7312 154.331 19.5 151C21.4058 147.412 22.9945 145.699 25.5 142.5C27.7202 139.666 28.8726 137.962 31.5 135.5C33.837 133.31 35.7632 132.792 38 130.5C40.0457 128.404 41.0055 127.019 42.5 124.5Z");
    			attr_dev(path22, "fill", "#E3193D");
    			add_location(path22, file$1, 75, 0, 45949);
    			attr_dev(g1, "id", "atrium-group");
    			add_location(g1, file$1, 59, 0, 29136);
    			attr_dev(g2, "id", "anatomicalHeart");
    			attr_dev(g2, "class", "svelte-1xgit7t");
    			add_location(g2, file$1, 47, 2, 769);
    			attr_dev(svg, "width", "100%");
    			attr_dev(svg, "height", "100%");
    			attr_dev(svg, "viewBox", "0 0 300 500");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			add_location(svg, file$1, 46, 2, 663);
    			attr_dev(div0, "class", "pericardium svelte-1xgit7t");
    			add_location(div0, file$1, 45, 2, 635);
    			attr_dev(div1, "class", "background svelte-1xgit7t");
    			add_location(div1, file$1, 44, 0, 608);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, svg);
    			append_dev(svg, g2);
    			append_dev(g2, g0);
    			append_dev(g0, path0);
    			append_dev(g0, path1);
    			append_dev(g0, path2);
    			append_dev(g0, path3);
    			append_dev(g0, path4);
    			append_dev(g0, path5);
    			append_dev(g0, path6);
    			append_dev(g0, path7);
    			append_dev(g0, path8);
    			append_dev(g2, g1);
    			append_dev(g1, path9);
    			append_dev(g1, ellipse0);
    			append_dev(g1, path10);
    			append_dev(g1, path11);
    			append_dev(g1, path12);
    			append_dev(g1, path13);
    			append_dev(g1, path14);
    			append_dev(g1, path15);
    			append_dev(g1, path16);
    			append_dev(g1, path17);
    			append_dev(g1, path18);
    			append_dev(g1, path19);
    			append_dev(g1, path20);
    			append_dev(g1, path21);
    			append_dev(g1, ellipse1);
    			append_dev(g1, path22);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div1);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$1.name, type: "component", source: "", ctx });
    	return block;
    }

    function instance$1($$self) {
    	onMount(() => {
        TweenMax.fromTo(anatomicalHeart,.6,
        {
          visible:true,
          scale:1
        },
        {
          scale:1.05,
          repeat: -1,
          ease: Elastic.easeOut,
          yoyo: true
      });
      });

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {};

    	return {};
    }

    class BeatingHeart extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "BeatingHeart", options, id: create_fragment$1.name });
    	}
    }

    /* src/Greeting.svelte generated by Svelte v3.12.1 */
    const { Error: Error_1 } = globals;

    const file$2 = "src/Greeting.svelte";

    // (125:4) {#if visible}
    function create_if_block$1(ctx) {
    	var p0, p0_intro, t1, p1, p1_intro, t3, p2, p2_intro;

    	const block = {
    		c: function create() {
    			p0 = element("p");
    			p0.textContent = "HELLO!";
    			t1 = space();
    			p1 = element("p");
    			p1.textContent = "MY NAME IS WADE";
    			t3 = space();
    			p2 = element("p");
    			p2.textContent = "I BUILD WEB APPS";
    			attr_dev(p0, "class", "greting1 svelte-9k3j43");
    			toggle_class(p0, "dn", ctx.dn1);
    			add_location(p0, file$2, 125, 4, 2283);
    			attr_dev(p1, "class", "greting2 svelte-9k3j43");
    			toggle_class(p1, "dn", ctx.dn2);
    			add_location(p1, file$2, 126, 3, 2347);
    			attr_dev(p2, "class", "greting3 svelte-9k3j43");
    			toggle_class(p2, "dn", ctx.dn3);
    			add_location(p2, file$2, 127, 3, 2420);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, p0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p1, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, p2, anchor);
    		},

    		p: function update(changed, ctx) {
    			if (changed.dn1) {
    				toggle_class(p0, "dn", ctx.dn1);
    			}

    			if (changed.dn2) {
    				toggle_class(p1, "dn", ctx.dn2);
    			}

    			if (changed.dn3) {
    				toggle_class(p2, "dn", ctx.dn3);
    			}
    		},

    		i: function intro(local) {
    			if (!p0_intro) {
    				add_render_callback(() => {
    					p0_intro = create_in_transition(p0, ctx.typewriter1, {});
    					p0_intro.start();
    				});
    			}

    			if (!p1_intro) {
    				add_render_callback(() => {
    					p1_intro = create_in_transition(p1, ctx.typewriter2, {});
    					p1_intro.start();
    				});
    			}

    			if (!p2_intro) {
    				add_render_callback(() => {
    					p2_intro = create_in_transition(p2, ctx.typewriter3, {});
    					p2_intro.start();
    				});
    			}
    		},

    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(p0);
    				detach_dev(t1);
    				detach_dev(p1);
    				detach_dev(t3);
    				detach_dev(p2);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block$1.name, type: "if", source: "(125:4) {#if visible}", ctx });
    	return block;
    }

    function create_fragment$2(ctx) {
    	var div2, div0, t0, div1, t1, current;

    	var if_block = (ctx.visible) && create_if_block$1(ctx);

    	var beatingheart = new BeatingHeart({ $$inline: true });

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			if (if_block) if_block.c();
    			t1 = space();
    			beatingheart.$$.fragment.c();
    			attr_dev(div0, "class", "left svelte-9k3j43");
    			add_location(div0, file$2, 122, 2, 2213);
    			attr_dev(div1, "class", "right svelte-9k3j43");
    			add_location(div1, file$2, 123, 2, 2240);
    			attr_dev(div2, "class", "landing-container svelte-9k3j43");
    			add_location(div2, file$2, 121, 0, 2179);
    		},

    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			if (if_block) if_block.m(div1, null);
    			append_dev(div2, t1);
    			mount_component(beatingheart, div2, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (ctx.visible) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    					transition_in(if_block, 1);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div1, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);

    			transition_in(beatingheart.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(beatingheart.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div2);
    			}

    			if (if_block) if_block.d();

    			destroy_component(beatingheart);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$2.name, type: "component", source: "", ctx });
    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	

      let dn1 = true;
      let dn2 = true;
      let dn3 = true;

      function typewriter1(node, { speed = 75 }) {
    		const valid = (
    			node.childNodes.length === 1 &&
    			node.childNodes[0].nodeType === 3
    		);

    		if (!valid) {
    			throw new Error(`This transition only works on elements with a single text node child`);
    		}

    		const text = node.textContent;
    		const duration = text.length * speed;

    		return {
    			duration,
    			tick: t => { setTimeout(() => {
            $$invalidate('dn1', dn1 = false);
            const i = ~~(text.length * t);
            node.textContent = text.slice(0, i);
          }, 800);
    				
    			}
    		};
      }

      function typewriter2(node, { speed = 75 }) {
    		const valid = (
    			node.childNodes.length === 1 &&
    			node.childNodes[0].nodeType === 3
    		);

    		if (!valid) {
    			throw new Error(`This transition only works on elements with a single text node child`);
    		}

    		const text = node.textContent;
    		const duration = text.length * speed;

    		return {
    			duration,
    			tick: t => { setTimeout(() => {
            $$invalidate('dn2', dn2 = false);
            const i = ~~(text.length * t);
            node.textContent = text.slice(0, i);
          }, 1800);
    				
    			}
        };
      }
        
      function typewriter3(node, { speed = 75 }) {
    		const valid = (
    			node.childNodes.length === 1 &&
    			node.childNodes[0].nodeType === 3
    		);

    		if (!valid) {
    			throw new Error(`This transition only works on elements with a single text node child`);
    		}

    		const text = node.textContent;
    		const duration = text.length * speed;

    		return {
    			duration,
    			tick: t => { setTimeout(() => {
            $$invalidate('dn3', dn3 = false);
            const i = ~~(text.length * t);
            node.textContent = text.slice(0, i);
          }, 3300);
    				
    			}
        };
      }

      let visible = false;
      
      onMount(() => {
        $$invalidate('visible', visible = true);
      });

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ('dn1' in $$props) $$invalidate('dn1', dn1 = $$props.dn1);
    		if ('dn2' in $$props) $$invalidate('dn2', dn2 = $$props.dn2);
    		if ('dn3' in $$props) $$invalidate('dn3', dn3 = $$props.dn3);
    		if ('visible' in $$props) $$invalidate('visible', visible = $$props.visible);
    	};

    	return {
    		dn1,
    		dn2,
    		dn3,
    		typewriter1,
    		typewriter2,
    		typewriter3,
    		visible
    	};
    }

    class Greeting extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Greeting", options, id: create_fragment$2.name });
    	}
    }

    /* src/AboutMe.svelte generated by Svelte v3.12.1 */

    const file$3 = "src/AboutMe.svelte";

    function create_fragment$3(ctx) {
    	var div4, div2, div0, img, t0, p, t1, a0, t3, a1, t5, a2, t7, t8, div1, a3, i0, t9, a4, i1, t10, a5, i2, t11, a6, i3, t12, div3;

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			img = element("img");
    			t0 = space();
    			p = element("p");
    			t1 = text("Wade is a full stack web developer and 2019 Coder Academy alumnus. Wade begun the 6 month boot camp style, fast track Diploma program at Coder Academy in February 2019. Th program is focussed on job ready, in demand web development skills. Among his acheivements in this program Wade completed two full stack web development group projects, the first a marketplace application built using Ruby on Rails deployed with Heroku (");
    			a0 = element("a");
    			a0.textContent = "GitHub Repo";
    			t3 = text(") and the second a project partnered with an external business stakeholder built with MERN stack application delpoyed with NOW.SH and Netlify (");
    			a1 = element("a");
    			a1.textContent = "Front End GitHub Repo";
    			t5 = text(", ");
    			a2 = element("a");
    			a2.textContent = "Back End GitHub Repo";
    			t7 = text(").");
    			t8 = space();
    			div1 = element("div");
    			a3 = element("a");
    			i0 = element("i");
    			t9 = space();
    			a4 = element("a");
    			i1 = element("i");
    			t10 = space();
    			a5 = element("a");
    			i2 = element("i");
    			t11 = space();
    			a6 = element("a");
    			i3 = element("i");
    			t12 = space();
    			div3 = element("div");
    			attr_dev(img, "class", "profile svelte-1h106ow");
    			attr_dev(img, "src", "images/profile.jpg");
    			attr_dev(img, "alt", "profile image");
    			add_location(img, file$3, 57, 6, 875);
    			attr_dev(a0, "href", "https://github.com/Wade-Martin/rails_marketplace_app");
    			add_location(a0, file$3, 59, 433, 1388);
    			attr_dev(a1, "href", "https://github.com/Wade-Martin/MERN-App-Front-End");
    			add_location(a1, file$3, 59, 654, 1609);
    			attr_dev(a2, "href", "https://github.com/timwaldron/MERN-App-Back-End");
    			add_location(a2, file$3, 59, 741, 1696);
    			attr_dev(p, "class", "svelte-1h106ow");
    			add_location(p, file$3, 58, 6, 950);
    			add_location(div0, file$3, 56, 4, 863);
    			attr_dev(i0, "class", "fab fa-github svelte-1h106ow");
    			add_location(i0, file$3, 63, 47, 1874);
    			attr_dev(a3, "href", "https://github.com/Wade-Martin");
    			add_location(a3, file$3, 63, 6, 1833);
    			attr_dev(i1, "class", "fab fa-codepen svelte-1h106ow");
    			add_location(i1, file$3, 64, 47, 1955);
    			attr_dev(a4, "href", "https://codepen.io/wade-martin");
    			add_location(a4, file$3, 64, 6, 1914);
    			attr_dev(i2, "class", "fab fa-linkedin svelte-1h106ow");
    			add_location(i2, file$3, 65, 59, 2049);
    			attr_dev(a5, "href", "https://www.linkedin.com/in/wade-s-martin/");
    			add_location(a5, file$3, 65, 6, 1996);
    			attr_dev(i3, "class", "fab fa-twitter-square svelte-1h106ow");
    			add_location(i3, file$3, 66, 50, 2135);
    			attr_dev(a6, "href", "https://twitter.com/wine_and_Wade");
    			add_location(a6, file$3, 66, 6, 2091);
    			attr_dev(div1, "class", "icons svelte-1h106ow");
    			add_location(div1, file$3, 62, 4, 1807);
    			attr_dev(div2, "class", "card svelte-1h106ow");
    			add_location(div2, file$3, 55, 2, 840);
    			attr_dev(div3, "class", "card svelte-1h106ow");
    			add_location(div3, file$3, 69, 2, 2199);
    			attr_dev(div4, "class", "about-container svelte-1h106ow");
    			add_location(div4, file$3, 54, 0, 808);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div2);
    			append_dev(div2, div0);
    			append_dev(div0, img);
    			append_dev(div0, t0);
    			append_dev(div0, p);
    			append_dev(p, t1);
    			append_dev(p, a0);
    			append_dev(p, t3);
    			append_dev(p, a1);
    			append_dev(p, t5);
    			append_dev(p, a2);
    			append_dev(p, t7);
    			append_dev(div2, t8);
    			append_dev(div2, div1);
    			append_dev(div1, a3);
    			append_dev(a3, i0);
    			append_dev(div1, t9);
    			append_dev(div1, a4);
    			append_dev(a4, i1);
    			append_dev(div1, t10);
    			append_dev(div1, a5);
    			append_dev(a5, i2);
    			append_dev(div1, t11);
    			append_dev(div1, a6);
    			append_dev(a6, i3);
    			append_dev(div4, t12);
    			append_dev(div4, div3);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div4);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$3.name, type: "component", source: "", ctx });
    	return block;
    }

    class AboutMe extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$3, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "AboutMe", options, id: create_fragment$3.name });
    	}
    }

    /* src/Contact.svelte generated by Svelte v3.12.1 */

    const file$4 = "src/Contact.svelte";

    function create_fragment$4(ctx) {
    	var svg, path0, path1, path2, t0, div, form, p, label, t1, input0, t2, input1, t3, input2, t4, textarea, t5, input3;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			t0 = space();
    			div = element("div");
    			form = element("form");
    			p = element("p");
    			label = element("label");
    			t1 = text("Don’t fill this out if you're human: ");
    			input0 = element("input");
    			t2 = space();
    			input1 = element("input");
    			t3 = space();
    			input2 = element("input");
    			t4 = space();
    			textarea = element("textarea");
    			t5 = space();
    			input3 = element("input");
    			attr_dev(path0, "d", "M1920 1078L1920 0.00305176L0.0020752 0.00622559L0.0020752 402.091V721.995L314.88 643.078L1920 1078Z");
    			attr_dev(path0, "fill", "black");
    			add_location(path0, file$4, 74, 1, 1403);
    			attr_dev(path1, "d", "M1920 1066.7V1079.99L421.496 1079.99L309.761 631.773L1920 1066.7Z");
    			attr_dev(path1, "fill", "#1D1D1D");
    			add_location(path1, file$4, 75, 1, 1529);
    			attr_dev(path2, "d", "M317.44 633.103L709.12 1080H-0.000427246V718.295L317.44 633.103Z");
    			attr_dev(path2, "fill", "#313131");
    			add_location(path2, file$4, 76, 1, 1623);
    			attr_dev(svg, "class", "background svelte-1tj5vtd");
    			attr_dev(svg, "viewBox", "0 0 1920 1080");
    			attr_dev(svg, "preserveAspectRatio", "none");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			add_location(svg, file$4, 73, 0, 1279);
    			attr_dev(input0, "name", "bot-field");
    			add_location(input0, file$4, 82, 50, 1901);
    			add_location(label, file$4, 82, 6, 1857);
    			attr_dev(p, "class", "dn svelte-1tj5vtd");
    			add_location(p, file$4, 81, 4, 1836);
    			attr_dev(input1, "name", "name");
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "class", "feedback-input svelte-1tj5vtd");
    			attr_dev(input1, "placeholder", "Name");
    			add_location(input1, file$4, 84, 4, 1949);
    			attr_dev(input2, "name", "email");
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "class", "feedback-input svelte-1tj5vtd");
    			attr_dev(input2, "placeholder", "Email");
    			add_location(input2, file$4, 85, 4, 2032);
    			attr_dev(textarea, "name", "text");
    			attr_dev(textarea, "class", "feedback-input svelte-1tj5vtd");
    			attr_dev(textarea, "placeholder", "Your Message here...");
    			add_location(textarea, file$4, 86, 4, 2114);
    			attr_dev(input3, "type", "submit");
    			input3.value = "SUBMIT";
    			attr_dev(input3, "class", "svelte-1tj5vtd");
    			add_location(input3, file$4, 87, 4, 2210);
    			attr_dev(form, "action", "https://formspree.io/wsmartin23@gmail.com");
    			attr_dev(form, "method", "POST");
    			add_location(form, file$4, 80, 2, 1754);
    			attr_dev(div, "class", "form-container svelte-1tj5vtd");
    			add_location(div, file$4, 79, 0, 1723);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    			append_dev(svg, path2);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, form);
    			append_dev(form, p);
    			append_dev(p, label);
    			append_dev(label, t1);
    			append_dev(label, input0);
    			append_dev(form, t2);
    			append_dev(form, input1);
    			append_dev(form, t3);
    			append_dev(form, input2);
    			append_dev(form, t4);
    			append_dev(form, textarea);
    			append_dev(form, t5);
    			append_dev(form, input3);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(svg);
    				detach_dev(t0);
    				detach_dev(div);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$4.name, type: "component", source: "", ctx });
    	return block;
    }

    class Contact extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$4, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Contact", options, id: create_fragment$4.name });
    	}
    }

    /* src/App.svelte generated by Svelte v3.12.1 */

    const file$5 = "src/App.svelte";

    function create_fragment$5(ctx) {
    	var div, t0, t1, t2, current;

    	var navbar = new NavBar({ $$inline: true });

    	var greeting = new Greeting({ $$inline: true });

    	var aboutme = new AboutMe({ $$inline: true });

    	var contact = new Contact({ $$inline: true });

    	const block = {
    		c: function create() {
    			div = element("div");
    			navbar.$$.fragment.c();
    			t0 = space();
    			greeting.$$.fragment.c();
    			t1 = space();
    			aboutme.$$.fragment.c();
    			t2 = space();
    			contact.$$.fragment.c();
    			attr_dev(div, "class", "svelte-q7k7y8");
    			add_location(div, file$5, 21, 0, 299);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(navbar, div, null);
    			append_dev(div, t0);
    			mount_component(greeting, div, null);
    			append_dev(div, t1);
    			mount_component(aboutme, div, null);
    			append_dev(div, t2);
    			mount_component(contact, div, null);
    			current = true;
    		},

    		p: noop,

    		i: function intro(local) {
    			if (current) return;
    			transition_in(navbar.$$.fragment, local);

    			transition_in(greeting.$$.fragment, local);

    			transition_in(aboutme.$$.fragment, local);

    			transition_in(contact.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(navbar.$$.fragment, local);
    			transition_out(greeting.$$.fragment, local);
    			transition_out(aboutme.$$.fragment, local);
    			transition_out(contact.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}

    			destroy_component(navbar);

    			destroy_component(greeting);

    			destroy_component(aboutme);

    			destroy_component(contact);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$5.name, type: "component", source: "", ctx });
    	return block;
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$5, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "App", options, id: create_fragment$5.name });
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
