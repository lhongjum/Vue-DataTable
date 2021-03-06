// @flow
import Vue from "vue";
import DataTable from "./data-table/index";
import {isPlainObject, deepClone} from "./util/index";
import {resolveDataMap} from "./data-map/index";
import {SingleTable, SeparateTable, FixedTable, CombineTable} from "./util/const";

// flow table 属性
type Table = {
    border?: boolean,
    rowClassName?: string,                          // 行类
    scrollHeight?: number,                          // 固定表头
    scrollWidth?: number
}

// flow Column 类型属性
type Column = {
    label: string,
    prop: string,
    headRender?: Function,
    width: number,
    render?: Function,
    type?: "string",
    fixed?: boolean,
    subs?: Array<Column> | Column,
    _checked: boolean,
    _rowspan: number,
    _colspan: number
};

function setGridAttr(level: Array<Object>, rowspan: number, columns: Array<Object>): number {
    let colspan = 0;

    for (let i=0;i<level.length;i++) {
        let el = level[i];

        if (el.subs) {
            el._rowspan = 1;
            el._colspan = setGridAttr(el.subs, rowspan - 1, columns);
            colspan += el._colspan;
        }else {
            columns.push(el);
            el._rowspan = rowspan;
            el._colspan = 1;
            colspan += 1;
        }
    }
    return colspan;
}

/* 递归后序遍历表格化数据，生成表格网状结构并生成表格数据列数组 */
function makeGrid(table: Array<Object>): Object {
    let columns = [];
    let level = table[0] || [];
    let maxRowspan = table.length;

    setGridAttr(level, maxRowspan, columns);
    return {
        table,
        columns
    };
}

/* 对表格列数据进行层级遍历，将其转换成表格标题视图映射所需的数据结构 */
function formatColumns(columns: Array<Object>, vm: Object): {theads: Array<Object>, columns: Array<Object>} {
    let table = [];                             // 表头数据格式
    let level = columns;

    while (level.length) {
        table.push(level);

        let nextLevel = [];
        for (let i=0;i<level.length;i++) {
            let el = level[i];

            if (isPlainObject(el.subs)) el.subs = [el.subs];
            if (Array.isArray(el.subs)) {
                for (let j=0;j<el.subs.length;j++) {
                    nextLevel.push(el.subs[j]);
                }
            }else {
                resolveDataMap(el, vm);             // 处理特殊数据类型到视图的映射
            }
        }
        level = nextLevel;
    }

    let tableObj = makeGrid(table);
    return {
        theads: tableObj.table,
        columns: tableObj.columns
    };
}

/* 创建一个新的表格组件 */
function Create(props: Object): ?Class<Vue> {
    if (!Array.isArray(props)) {
        console.error("props 只能接受数组列对象");
        return;
    }

    let DataTableOptions = deepClone(DataTable);                                    // 确保每次Create都是从模板创建一个新的类
    let tableData = DataTableOptions.data;

    DataTableOptions.data = function () {
        let copyProps= deepClone(props);                                            // 确保表格实例化所得的每个对象是从模板所得的副本, 而不是参数对象本身
        let {theads, columns}= formatColumns(copyProps, this);

        let dataOptions = {
            theads,
            columns,
            propColumns: copyProps
        };

        return Object.assign(dataOptions, tableData);
    };

    const VueDataTable = Vue.extend(DataTableOptions);

    /* 可扩展列API */
    VueDataTable.prototype.$scaledTable = function<callback: Function> (fn: callback): void {
        if (typeof fn === "function") fn(this.propColumns);

        let columnObj = formatColumns(this.propColumns, this);
        this.theads = columnObj.theads;
        this.columns = columnObj.columns;
    };

    /* 表格数据刷新API */
    VueDataTable.prototype.$refreshTableData = function (): void {
        if (!this.TableMode || !this.$refs) return;

        if (this.TableMode === SingleTable || this.TableMode === SeparateTable) {
            this.$refs.tbody.$forceUpdate();
        }else {
            /* 固定列表格刷新全部子表格 */
            this.$refs.tbody.$forceUpdate();
            this.$refs.leftTbody.$forceUpdate();
            this.$refs.rightTbody.$forceUpdate();
        }
    };

    return VueDataTable;
}

export default Create;

