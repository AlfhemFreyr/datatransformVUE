<!-- <template>
  <div>
    <div
      ref="chartsDOM"
      class="map"
      style="width: 1000px; height: 540px"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import * as echarts from 'echarts'

// 资源：图片 & 地图 JSON
// 若报类型错误，见文末“类型声明”小节
import wxb from '@/assets/img/wxb.png'
import Changping from '@/assets/map/Changping.json'

// DOM 引用（Vue3 不再用 this.$refs）
const chartsDOM = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

const initCharts = () => {
  if (!chartsDOM.value) return
  chart = echarts.init(chartsDOM.value)

  // 注册地图（名称需与 series/geo 中的 map 保持一致）
  echarts.registerMap('Changping', Changping as any)

  const option: echarts.EChartsOption = {
    series: [
      {
        name: '昌平地图',
        type: 'map',
        top: '10%',
        zlevel: 5,
        map: 'ZhengZhouMap',
        label: {
          show: true,
          color: '#fff'
        },
        itemStyle: {
          areaColor: '#1f75b8',
          borderColor: '#93eaf8',
          borderWidth: 0.5,
          opacity: 1
        },
        emphasis: {
          itemStyle: { areaColor: '#77e8e4' }
        },
        select: {
          label: { color: '#000000' },
          itemStyle: { areaColor: '#77e8e4' }
        }
      },
      // 波纹动画点
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: [{ value: [113.546928, 34.780838] }],
        showEffectOn: 'render',
        rippleEffect: { scale: 4, brushType: 'stroke' },
        hoverAnimation: true,
        label: {
          show: true,
          formatter: '{b}',
          position: 'right',
          fontWeight: 500,
          fontSize: 10
        },
        itemStyle: {
          color: '#32cd32',
          shadowBlur: 10,
          shadowColor: '#333'
        },
        emphasis: { itemStyle: { color: '#f4e925' } },
        zlevel: 6
      },
      // 自定义图标（用 label 背景图的写法，按你的原样）
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: [{ value: [113.686037, 34.775838] }],
        showEffectOn: 'render',
        hoverAnimation: true,
        label: {
          show: true,
          formatter: '{b}',
          position: 'right',
          fontWeight: 500,
          fontSize: 10,
          width: 50,
          height: 50,
          backgroundColor: { image: wxb } // 也可以用 symbol: 'image://' 的方式
        },
        itemStyle: { color: 'transparent', shadowBlur: 10, shadowColor: '#333' },
        zlevel: 6
      }
    ],
    // 叠三层 geo 做立体边框感
    geo: [
      {
        map: 'ZhengZhouMap',
        top: '11%',
        zlevel: 4,
        itemStyle: { color: '#3C5FA1', borderWidth: 1, borderColor: '#3C5FA1' }
      },
      {
        map: 'ZhengZhouMap',
        top: '12%',
        zlevel: 3,
        itemStyle: { color: '#163F6C', borderWidth: 1, borderColor: '#163F6C' }
      },
      {
        map: 'ZhengZhouMap',
        top: '13%',
        zlevel: 2,
        itemStyle: {
          color: '#31A0E6',
          borderWidth: 1,
          borderColor: '#31A0E6',
          shadowColor: '#fff',
          shadowBlur: 10
        }
      }
    ]
  }

  chart.setOption(option)

  // 事件（注意：在 Vue3 里直接用 chart）
  chart.on('click', (params) => {
    console.log(params)
  })
}

onMounted(() => {
  initCharts()
  // 自适应
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (chart) {
    chart.dispose()
    chart = null
  }
})

function handleResize() {
  chart?.resize()
}
</script>

<style scoped>
.map {
  /* 可在此放一些容器样式 */
}
</style> -->
<template>
  <div>
    <div
      ref="chartsDOM"
      class="map"
      style="width: 1000px; height: 540px"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import * as echarts from 'echarts'
import Changping from '@/assets/map/Changping.json'

const chartsDOM = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

const initCharts = () => {
  if (!chartsDOM.value) return
  chart = echarts.init(chartsDOM.value)

  // 注册地图（名称与下方 map 字段一致）
  echarts.registerMap('Changping', Changping as any)

  const option: echarts.EChartsOption = {
    series: [
      {
        name: '昌平地图',
        type: 'map',
        top: '10%',
        zlevel: 5,
        map: 'Changping',            // ✅ 修正为 Changping
        label: { show: true, color: '#fff' },
        itemStyle: {
          areaColor: '#1f75b8',
          borderColor: '#93eaf8',
          borderWidth: 0.5,
          opacity: 1
        },
        emphasis: { itemStyle: { areaColor: '#77e8e4' } },
        select: {
          label: { color: '#000000' },
          itemStyle: { areaColor: '#77e8e4' }
        }
      },

      // 波纹动画点（示例经纬度需换成昌平范围内的坐标）
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: [{ value: [116.23, 40.22] }], // 🔁 替换为你自己的点
        showEffectOn: 'render',
        rippleEffect: { scale: 4, brushType: 'stroke' },
        hoverAnimation: true,
        label: {
          show: true,
          formatter: '{b}',
          position: 'right',
          fontWeight: 500,
          fontSize: 10
        },
        itemStyle: { color: '#32cd32', shadowBlur: 10, shadowColor: '#333' },
        emphasis: { itemStyle: { color: '#f4e925' } },
        zlevel: 6
      },

      // 内置 symbol（不再依赖图片）
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: [{ value: [116.30, 40.10] }], // 🔁 替换为你自己的点
        showEffectOn: 'render',
        hoverAnimation: true,
        // ✅ 用内置图标：pin / circle / diamond / triangle / rect / roundRect / arrow / none
        symbol: 'pin',
        symbolSize: 28,
        rippleEffect: { scale: 3 },
        label: { show: false },
        itemStyle: { color: '#e54d42' }, // 图标主色
        zlevel: 6
      }
    ],

    // 叠三层 geo 做立体边框感（map 同步改名）
    geo: [
      {
        map: 'Changping',            // ✅
        top: '11%',
        zlevel: 4,
        itemStyle: { color: '#3C5FA1', borderWidth: 1, borderColor: '#3C5FA1' }
      },
      {
        map: 'Changping',            // ✅
        top: '12%',
        zlevel: 3,
        itemStyle: { color: '#163F6C', borderWidth: 1, borderColor: '#163F6C' }
      },
      {
        map: 'Changping',            // ✅
        top: '13%',
        zlevel: 2,
        itemStyle: {
          color: '#31A0E6',
          borderWidth: 1,
          borderColor: '#31A0E6',
          shadowColor: '#fff',
          shadowBlur: 10
        }
      }
    ]
  }

  chart.setOption(option)
  chart.on('click', (params) => console.log(params))
}

onMounted(() => {
  initCharts()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (chart) { chart.dispose(); chart = null }
})

function handleResize() { chart?.resize() }
</script>

<style scoped>
.map { }
</style>
