import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import * as echarts from 'echarts'

// 创建应用实例
const app = createApp(App)

// 将 echarts 挂载到全局
app.config.globalProperties.$echarts = echarts

// 挂载应用
app.mount('#app')
