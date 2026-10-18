/* 功能：后台计算运动学图，保持页面表单响应。
 * 方法：按反应类型调用各页面导出的纯函数，并通过消息返回数据或错误。
 * 注意事项：仅浏览器模块 Worker 使用；无网络计算或外部源码访问。
 */
import { twoBodyCurves } from '../../kinematics/two-body/script.js';
import { threeBodyCurves } from '../../kinematics/three-body/script.js';
self.onmessage = ({ data }) => {
  try { self.postMessage({ plots: data.reaction.kind === 'two' ? twoBodyCurves(data.reaction) : threeBodyCurves(data.reaction, data.fine) }); }
  catch (error) { self.postMessage({ error: error.message }); }
};
