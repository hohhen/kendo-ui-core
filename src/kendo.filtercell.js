(function(f, define){
    define([ "./kendo.autocomplete", "./kendo.datepicker", "./kendo.numerictextbox", "./kendo.dropdownlist" ], f);
})(function(){

var __meta__ = {
    id: "filtercell",
    name: "Row filter",
    category: "framework",
    depends: [ "autocomplete" ],
    advanced: true
};

(function($, undefined) {
    var kendo = window.kendo,
        ui = kendo.ui,
        DataSource = kendo.data.DataSource,
        Widget = ui.Widget,
        CHANGE = "change",
        STRING = "string",
        NS = ".kendoFilterCell",
        EQ = "Is equal to",
        NEQ = "Is not equal to",
        proxy = $.proxy;

    function findFilterForField(filter, field) {
        var filters = [];
        if ($.isPlainObject(filter)) {
            if (filter.hasOwnProperty("filters")) {
                filters = filter.filters;
            } else if(filter.field == field) {
                return filter;
            }
        }
        if (($.isArray(filter))) {
           filters = filter;
        }

        for (var i = 0; i < filters.length; i++) {
          var result = findFilterForField(filters[i], field);
          if (result) {
             return result;
          }
        }
    }

    function removeFiltersForField(expression, field) {
        if (expression.filters) {
            expression.filters = $.grep(expression.filters, function(filter) {
                removeFiltersForField(filter, field);
                if (filter.filters) {
                    return filter.filters.length;
                } else {
                    return filter.field != field;
                }
            });
        }
    }

    var FilterCell = Widget.extend( {
        init: function(element, options) {
            var that = this,
                dataSource,
                viewModel,
                type,
                input = that.input = $("<input/>")
                    .attr(kendo.attr("bind"), "value: value")
                    .appendTo(element);

            Widget.fn.init.call(that, element, options);
            options = that.options;
            dataSource = that.dataSource = options.dataSource;
            that.acDataSource = acDataSource = options.acDataSource || dataSource.options;

            if (!(acDataSource instanceof DataSource)) {
                acDataSource = that.acDataSource = options.acDataSource = DataSource.create(acDataSource);
            }

            if (acDataSource.group()) {
                acDataSource.group([]);
            }
            //gets the type from the dataSource or sets default to string
            that.model = dataSource.options.schema.model;
            type = options.type = kendo.getter("options.schema.model.fields['" + options.field + "'].type", true)(dataSource) || STRING;


            element = $(element);
            element.addClass("grid-filter-header");

            that._parse = function(value) {
                 return value + "";
            };

            if (that.model && that.model.fields) {
                var field = that.model.fields[options.field];

                if (field) {
                    if (field.parse) {
                        that._parse = proxy(field.parse, field);
                    }
                }
            }

            that.viewModel = viewModel = kendo.observable({
                operator: options.operator || "eq",
                value: null
            });
            viewModel.bind(CHANGE, proxy(that.updateDsFilter, that));

            that._setInputType(options, type);

            that._createClearIcon();

            kendo.bind(input, viewModel);

            that.setACDataSource(acDataSource);

            that.refreshUI();

            that._refreshHandler = proxy(that.refreshUI, that);

            that.dataSource.bind(CHANGE, that._refreshHandler);

        },

        _setInputType: function(options, type) {
            var that = this,
                input = that.input;

            if (typeof (options.template) == "function") {
                options.template.call(that.viewModel, that.input);
            } else if (type == STRING) {
                input.attr(kendo.attr("role"), "autocomplete")
                        .attr(kendo.attr("text-field"), that.options.field)
                        .attr(kendo.attr("value-primitive"), true);
            } else if (type == "date") {
                input.attr(kendo.attr("role"), "datepicker")
            } else if (type == "number") {
                input.attr(kendo.attr("role"), "numerictextbox")
            } //TODO enums
        },

        setACDataSource: function(dataSource) {
            var ac = this.input.data("kendoAutoComplete");
            if (ac) {
                ac.setDataSource(dataSource);
            }
        },

        //CLEAR/RESET filter could be the same from filtermenu.js

        refreshUI: function() {
            var that = this;
            that._bind();
        },

        _bind: function() {
            var that = this,
                filter = findFilterForField(that.dataSource.filter(), this.options.field) || {},
                viewModel = that.viewModel;

            that.manuallyUpdatingVM = true;
            if (filter.operator) {
                viewModel.set("operator", filter.operator);
            }
            viewModel.set("value", filter.value);
            that.manuallyUpdatingVM = false;
        },

        updateDsFilter: function() {
            var that = this,
                model = that.viewModel;

            if (that.manuallyUpdatingVM) {
                return;
            }

            var currentFilter = $.extend({}, that.viewModel.toJSON(), { field: that.options.field });

            var expression = {
                logic: "and",
                filters: [currentFilter]
            };
            var mergeResult = that._merge(expression);
            if (mergeResult.filters.length) {
                that.dataSource.filter(mergeResult);
            } else {
                that.dataSource.filter({});
            }
        },

        _merge: function(expression) {
            var that = this,
                logic = expression.logic || "and",
                filters = expression.filters,
                filter,
                result = that.dataSource.filter() || { filters:[], logic: "and" },
                idx,
                length;

            removeFiltersForField(result, that.options.field);

            filters = $.grep(filters, function(filter) {
                return filter.value !== "" && filter.value !== null;
            });

            for (idx = 0, length = filters.length; idx < length; idx++) {
                filter = filters[idx];
                filter.value = that._parse(filter.value);
            }

            if (filters.length) {
                if (result.filters.length) {
                    expression.filters = filters;

                    if (result.logic !== "and") {
                        result.filters = [ { logic: result.logic, filters: result.filters }];
                        result.logic = "and";
                    }

                    if (filters.length > 1) {
                        result.filters.push(expression);
                    } else {
                        result.filters.push(filters[0]);
                    }
                } else {
                    result.filters = filters;
                    result.logic = logic;
                }
            }

            return result;
        },

        _createClearIcon: function() {
            var that = this;

            $("<span/>")
                .addClass("k-icon k-i-close")
                .click(proxy(that.clearFilter, that))
                .appendTo(that.element);
        },

        clearFilter: function() {
            this.viewModel.set("value", null);
        },

        destroy: function() {
            var that = this;

            that.filterModel = null;

            Widget.fn.destroy.call(that);

            kendo.destroy(that.element);
        },

        events: [
            CHANGE
        ],

        options: {
            name: "FilterCell",
            autoBind: true,
            field: "",
            type: "string",
            acDataSource: null,
            operator: "eq",
            template: null,
            operators: {
                string: {
                    eq: EQ,
                    neq: NEQ,
                    startswith: "Starts with",
                    contains: "Contains",
                    doesnotcontain: "Does not contain",
                    endswith: "Ends with"
                },
                number: {
                    eq: EQ,
                    neq: NEQ,
                    gte: "Is greater than or equal to",
                    gt: "Is greater than",
                    lte: "Is less than or equal to",
                    lt: "Is less than"
                },
                date: {
                    eq: EQ,
                    neq: NEQ,
                    gte: "Is after or equal to",
                    gt: "Is after",
                    lte: "Is before or equal to",
                    lt: "Is before"
                },
                enums: {
                    eq: EQ,
                    neq: NEQ
                }
            },
            messages: {
                isTrue: "is true",
                isFalse: "is false",
                filter: "Filter",
                clear: "Clear",
                and: "And",
                or: "Or",
                operator: "Operator",
                value: "Value",
                cancel: "Cancel"
            }
        },

        setDataSource: function(dataSource) {
            var that = this;
            that.dataSource.unbind(CHANGE, that._refreshHandler);
            that.dataSource = that.options.dataSource = dataSource;
            dataSource.bind(CHANGE, that._refreshHandler);

            if (that.options.autoBind) {
                dataSource.fetch();
            }
        }
    });

    ui.plugin(FilterCell);
})(window.kendo.jQuery);

return window.kendo;

}, typeof define == 'function' && define.amd ? define : function(_, f){ f(); });
