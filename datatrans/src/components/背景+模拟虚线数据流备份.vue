
<template>
  <div class="page">
    <!-- 可选全屏背景图，可通过 bgOpacity 调整透明度 -->
    <!-- <transition name="fade">
      <div
        :key="bgIndex"
        class="bg"
        :style="{ backgroundImage: `url(${currentBg})`, '--bg-opacity': bgOpacity }"
      />
    </transition> -->
     <div
       ref="chartsDOM"
       class="map"
       style="width: 1000px; height: 540px"
     ></div>
   </div>
 </template>
<script setup lang="ts">
import bg1 from '@/assets/img/haidian.jpg'
import bg2 from '@/assets/img/shahe.jpg'
import bg3 from '@/assets/img/hangzhou.jpg'
const bgOpacity = ref(0.55)         // 透明度（0 ~ 1）
const images = [bg1, bg2, bg3]
const bgIndex = ref(0)
const currentBg = computed(() => images[bgIndex.value])
let bgTimer: number | undefined

import { onMounted, onUnmounted, ref, computed } from 'vue'
import * as echarts from 'echarts'

// 1) 引入三个区域的 GeoJSON（路径/大小写需与文件一致）
import Changping from '@/assets/map/Changping.json'
import Haidian from '@/assets/map/Haidian.json'
import Yuhang from '@/assets/map/Yuhang.json'
const chartsDOM = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

// 计算 GeoJSON 的经纬度中心（取外包框中心，稳妥且足够用于标注）
function bboxCenter(geojson: any): [number, number] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  const pushCoord = (lng: number, lat: number) => {
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }
  try {
    for (const f of geojson.features ?? []) {
      const g = f.geometry
      if (!g) continue
      if (g.type === 'Polygon') {
        for (const ring of g.coordinates) {
          for (const [lng, lat] of ring) pushCoord(lng, lat)
        }
      } else if (g.type === 'MultiPolygon') {
        for (const poly of g.coordinates) {
          for (const ring of poly) {
            for (const [lng, lat] of ring) pushCoord(lng, lat)
          }
        }
      }
    }
  } catch (e) {
    // 兜底：如果解析失败，返回北京天安门附近
    return [116.397, 39.908]
  }
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
}
// 新增：三所校区的经纬度（与 symbol 保持一致）
const CP_SCHOOL: [number, number] = [116.28, 40.1593]   // 昌平-沙河
const HD_SCHOOL: [number, number] = [116.35, 39.99]     // 海淀-学院路
const YH_SCHOOL: [number, number] = [119.98,30.37]     // 余杭-杭州

// 新增：将经纬度转换为像素坐标（指定 geoIndex）
// 替换原先基于 geoIndex 的版本
function toPixel(seriesIndex: number, lnglat: [number, number]) {
  return chart!.convertToPixel({ seriesIndex }, lnglat) as [number, number]
}

// 替换原函数：支持指定一个参考点 outwardFrom，使弧线朝远离该点的方向弯曲
function makeCurve(
  p1: [number, number],
  p2: [number, number],
  k = 0.22,
  color = '#00eaff',
  outwardFrom?: [number, number],
  offset = 0,                  //沿法向量的并行偏移（像素）
  reverse = false              //是否反向移动
) {
  const [x1, y1] = p1
  const [x2, y2] = p2
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len

  // 计算控制点方向：如果提供 outwardFrom，就让控制点远离该点（实现“向外弯”）
  let sign = 1
  if (outwardFrom) {
    const vx = outwardFrom[0] - mx
    const vy = outwardFrom[1] - my
    // normal 与 指向 outwardFrom 的向量同向 -> 取反，保证控制点远离 outwardFrom
    if (nx * vx + ny * vy > 0) sign = -1
  }

  const cpx0 = mx + nx * len * k * sign
  const cpy0 = my + ny * len * k * sign
  // 并行偏移（让两条弧线平行且分离）
  const offx = nx * offset
  const offy = ny * offset

  const X1 = x1 + offx
  const Y1 = y1 + offy
  const X2 = x2 + offx
  const Y2 = y2 + offy
  const cpx = cpx0 + offx
  const cpy = cpy0 + offy

  return {
    type: 'bezierCurve',
    shape: { x1, y1, x2, y2, cpx1: cpx, cpy1: cpy },
    style: {
      stroke: color,
      lineWidth: 2,
      opacity: 0.9,
      shadowBlur: 10,
      shadowColor: color,
      lineDash: [10, 10],
      lineDashOffset: 0
    },
    silent: true,
    zlevel: 10,
    z: 1000,
    keyframeAnimation: {
      duration: 1800,
      loop: true,
      keyframes: [
        { percent: 0, style: { lineDashOffset: 0 } },
        // 反向：用 +40；正向：用 -40
        { percent: 1, style: { lineDashOffset: reverse ? 40 : -40 } }
      ]
    }
  } as echarts.EChartsGraphicElementOption
}

// 新增：根据当前尺寸重算三条弧并渲染到 graphic
function updateFlowArcs() {
  if (!chart) return
  // 约定：seriesIndex 0=海淀map，1=昌平map，2=余杭map
  const pHD = toPixel(0, HD_SCHOOL)
  const pCP = toPixel(1, CP_SCHOOL)
  const pYH = toPixel(2, YH_SCHOOL)
  // 以三点质心作为 outwardFrom，使弧线朝“外侧”弯
  const center: [number, number] = [
    (pHD[0] + pCP[0] + pYH[0]) / 3,
    (pHD[1] + pCP[1] + pYH[1]) / 3
  ]
  const elements = [
    makeCurve(pCP, pHD, 0.24, '#00ff00', center), // 昌平 → 海淀
    makeCurve(pHD, pYH, 0.24, '#00ff00', center), // 海淀 → 余杭
    makeCurve(pYH, pCP, 0.24, '#00ff00', center)  // 余杭 → 昌平
  ]

  // 新增：并行且反向的一组弧线（offset 可按需调大/调小，比如 8~12）
  elements.push(
    makeCurve(pCP, pHD, 0.24, '#ffff66', center, 12, true),   // 反向 & 并行
    makeCurve(pHD, pYH, 0.24, '#ffff66', center, 12, true),
    makeCurve(pYH, pCP, 0.24, '#ffff66', center, 12, true)
  )
  chart.setOption({ graphic: { elements } }, { replaceMerge: ['graphic'] })
}

const initCharts = () => {
  if (!chartsDOM.value) return
  chart = echarts.init(chartsDOM.value)

  // 2) 注册三张地图
  echarts.registerMap('Haidian', Haidian as any)
  echarts.registerMap('Changping', Changping as any)
  echarts.registerMap('Yuhang', Yuhang as any)

  // 3) 计算三个区的中心点（用于波纹动画点）
  const centerHaidian = bboxCenter(Haidian)
  const centerChangping = bboxCenter(Changping)
  const centerYuhang = bboxCenter(Yuhang)

  // 三角布局参数（可按需微调）
  const topMap = { left: '35%', top: '8%', width: '30%', height: '38%' }   // 海淀（上中）
  const leftBottomMap = { left: '6%', top: '56%', width: '38%', height: '40%' } // 昌平（左下）
  const rightBottomMap = { right: '6%', top: '56%', width: '38%', height: '40%' } // 余杭（右下）

  // 立体边框三层样式（与原代码一致）
  const layer1Style = { color: '#3C5FA1', borderWidth: 1, borderColor: '#3C5FA1' }
  const layer2Style = { color: '#163F6C', borderWidth: 1, borderColor: '#163F6C' }
  const layer3Style = { color: '#31A0E6', borderWidth: 1, borderColor: '#31A0E6', shadowColor: '#fff', shadowBlur: 10 }

  // 通用 itemStyle / label
  const baseItemStyle = {
    areaColor: '#1f75b8',
    borderColor: '#93eaf8',
    borderWidth: 0.8
  }
  const baseLabel = { show: true, color: '#fff', fontSize: 10 }

  // geo 数组顺序很重要（用于 geoIndex）
  // 对每个区：先放 3 层“立体边框 geo”（top 递增 1%、2%、3%），然后 map 系列引用第 1 层（该区的“主 geo”）
  const geos: echarts.GeoComponentOption[] = [
    // 海淀：三层
    { map: 'Haidian', ...topMap, top: '9%',  zlevel: 4, itemStyle: layer1Style },
    { map: 'Haidian', ...topMap, top: '10%', zlevel: 3, itemStyle: layer2Style },
    { map: 'Haidian', ...topMap, top: '11%', zlevel: 2, itemStyle: layer3Style },

    // 昌平：三层
    { map: 'Changping', ...leftBottomMap, top: '57%', zlevel: 4, itemStyle: layer1Style },
    { map: 'Changping', ...leftBottomMap, top: '58%', zlevel: 3, itemStyle: layer2Style },
    { map: 'Changping', ...leftBottomMap, top: '59%', zlevel: 2, itemStyle: layer3Style },

    // 余杭：三层
    { map: 'Yuhang', ...rightBottomMap, top: '57%', zlevel: 4, itemStyle: layer1Style },
    { map: 'Yuhang', ...rightBottomMap, top: '58%', zlevel: 3, itemStyle: layer2Style },
    { map: 'Yuhang', ...rightBottomMap, top: '59%', zlevel: 2, itemStyle: layer3Style }
  ]

  // 方便引用的 geoIndex（每个区第 1 层作为“主 geo”）
  const GI_HAIDIAN = 0
  const GI_CHANGPING = 3
  const GI_YUHANG = 6

  const option: echarts.EChartsOption = {
    tooltip: { trigger: 'item' },

    // 4) 三张地图（map 系列），分别绑定到对应主 geo 上（保留你原来的地图样式）
    series: [
      {
        name: '北京海淀区',
        type: 'map',
        map: 'Haidian',
        geoIndex: GI_HAIDIAN,
        zlevel: 5,
        label: baseLabel,
        itemStyle: baseItemStyle,
        emphasis: { itemStyle: { areaColor: '#77e8e4' } },
        select: { itemStyle: { areaColor: '#77e8e4' } }
      },
      {
        name: '北京昌平区',
        type: 'map',
        map: 'Changping',
        geoIndex: GI_CHANGPING,
        zlevel: 5,
        label: baseLabel,
        itemStyle: baseItemStyle,
        emphasis: { itemStyle: { areaColor: '#77e8e4' } },
        select: { itemStyle: { areaColor: '#77e8e4' } }
      },
      {
        name: '杭州余杭区',
        type: 'map',
        map: 'Yuhang',
        geoIndex: GI_YUHANG,
        zlevel: 5,
        label: baseLabel,
        itemStyle: baseItemStyle,
        emphasis: { itemStyle: { areaColor: '#77e8e4' } },
        select: { itemStyle: { areaColor: '#77e8e4' } }
      },

      // 5) 波纹动画点：显示各区名称，标在该区中心点（每区一个 effectScatter）
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        geoIndex: GI_HAIDIAN,
        zlevel: 6,
        showEffectOn: 'render',
        rippleEffect: { scale: 4, brushType: 'stroke' },
        label: { show: true, formatter: '海淀区', position: 'top', fontSize: 12, fontWeight: 600 },
        itemStyle: { color: '#32cd32', shadowBlur: 10, shadowColor: '#333' },
        data: [{ value: centerHaidian }]
      },
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        geoIndex: GI_CHANGPING,
        zlevel: 6,
        showEffectOn: 'render',
        rippleEffect: { scale: 4, brushType: 'stroke' },
        label: { show: true, formatter: '昌平区', position: 'top', fontSize: 12, fontWeight: 600 },
        itemStyle: { color: '#32cd32', shadowBlur: 10, shadowColor: '#333' },
        data: [{ value: centerChangping }]
      },
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        geoIndex: GI_YUHANG,
        zlevel: 6,
        showEffectOn: 'render',
        rippleEffect: { scale: 4, brushType: 'stroke' },
        label: { show: true, formatter: '余杭区', position: 'top', fontSize: 12, fontWeight: 600 },
        itemStyle: { color: '#32cd32', shadowBlur: 10, shadowColor: '#333' },
        data: [{ value: centerYuhang }]
      },

      // 6) 内置 symbol 定位点：三个校区（分别绑定到对应区的 geo）
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        geoIndex: GI_CHANGPING,
        zlevel: 7,
        showEffectOn: 'render',
        symbol: 'pin',
        symbolSize: 26,
        label: { show: true, formatter: '北航沙河校区', position: 'top' },
        itemStyle: { color: '#e6a23c' },
        data: [{  name: '北航沙河校区', value: [116.28, 40.1593] }]
      },
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        geoIndex: GI_HAIDIAN,
        zlevel: 7,
        showEffectOn: 'render',
        symbol: 'pin',
        symbolSize: 26,
        label: { show: true, formatter: '北航学院路校区', position: 'top' },
        itemStyle: { color: '#ff5733' },
        data: [{  name: '北航学院路校区', value: [116.35, 39.99] }]
      },
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        geoIndex: GI_YUHANG,
        zlevel: 7,
        showEffectOn: 'render',
        symbol: 'pin',
        symbolSize: 26,
        label: { show: true, formatter: '北航杭州校区', position: 'top' },
        itemStyle: { color: '#ff69b4' },
        data: [{  name: '北航杭州校区', value: [119.98,30.37] }]
      }
    ],

    // 7) 叠三层 geo 做立体边框感（每个区各 3 层，map 同步改名）
    geo: geos
  }

  chart.setOption(option)
  // 可选：首次渲染后绘制“空中弧形数据流”
  // updateFlowArcs()
  chart.on('click', (params) => console.log('[click]', params))
}

onMounted(() => {
  bgTimer = window.setInterval(() => {
    bgIndex.value = (bgIndex.value + 1) % images.length
  }, 4000) // 4 秒
  initCharts()
  window.addEventListener('resize', handleResize)
})
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (chart) { chart.dispose(); chart = null }
  if (bgTimer) window.clearInterval(bgTimer)
})
function handleResize() { chart?.resize() }
</script>

<style scoped>
  .page {
    position: relative;
    min-height: 100vh; /* 让背景至少覆盖一屏 */
  }
  .bg {
    position: fixed;
    inset: 0;                    /* 顶/右/底/左全贴合 */
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    z-index: 0;                  /* 在底层 */
    pointer-events: none;        /* 不挡鼠标 */
    transition: opacity .25s;    /* 调整透明度有过渡 */
    opacity: var(--bg-opacity, 1);
  }
  .map {
    position: relative;
    z-index: 1;                  /* 确保图表在背景之上 */
  }
  /* 渐出渐入过渡（可调时长/缓动） */
  .fade-enter-active, .fade-leave-active {
    transition: opacity .8s ease;
  }
  .fade-enter-from, .fade-leave-to {
    opacity: 0;
  }
  .fade-enter-to, .fade-leave-from {
    opacity: var(--bg-opacity, 1);
  }
</style>
