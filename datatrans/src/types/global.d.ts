import * as echarts from 'echarts'

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $echarts: typeof echarts
  }
}
