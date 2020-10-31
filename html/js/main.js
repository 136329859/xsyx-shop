// vue swiper组件
Vue.use(VueAwesomeSwiper)
const app = new Vue({
  el: '#app',
  components: vueComponents,
  data: {
    showLogin: false,
    cates: [],
    selectCate: 0,
    malls: [],
    contentRoutre: 'cart', // 详情页面显示路由 cart 购物车(默认) goods-detail商品详情 order 订单
    selectMall: {},
    cart: [],
    showUserInfo: false,
    userInfo: {},
    storeInfo: {},
    totalPrice: 0,
    filter: [
      {
        title: '限购',
        name: 'limit',
        value: 0,
        list: [{ name: '商品限购 全部', value: 0 }, { name: '1件', value: 1 }, { name: '2件', value: 2 }, { name: '10件', value: 10 }]
      },
      {
        title: '时间',
        name: 'time',
        value: 'all',
        list: [{ name: '全部时间', value: 'all' }, { name: '0点', value: '00:00' }, { name: '10点', value: '10:00' }]
      }
    ],
    // 版本更新
    updateInfo: {
      url: '',
      name: '',
      message: '',
      show: false
    },
    // 播放视频
    videoUrl: '',
    storeShow: false
  },
  mounted() {
    this.init()
    this.update()
  },
  methods: {
    async init() {
      await this.login()
      this.cates = await request({
        url: 'index/cates'
      })
      this.selectCate = 0
      this.getMalls()
    },
    nav(url) {
      const { shell } = require('electron')
      shell.openExternal(url)
    },
    update() {
      $.ajax({
        url: 'https://api.github.com/repos/ShaoGongBra/xsyx-shop/releases/latest',
        success: res => {
          const version = require("../package.json").version.split('.')
          const newVersion = res.tag_name.split('.')
          for (let i = 0; i < version.length; i++) {
            if (Number(version[i]) < Number(newVersion[i])) {
              this.updateInfo = {
                url: res.html_url,
                message: res.body,
                name: res.name,
                show: true
              }
              break
            }
          }

        }
      })
    },
    async getUserInfo(key) {
      if (!key) {
        toast('请输入key')
        throw { message: '请输入key' }
      }
      if (key.length !== 36) {
        toast('无效的key')
        throw { message: '无效的key' }
      }
      try {
        this.userInfo = await request({
          url: 'index/getUserInfo',
          data: {
            key
          }
        })
        this.userInfo.key = key
        this.storeInfo = this.userInfo.storeInfo
        localStorage.setItem('userInfo', JSON.stringify(this.userInfo))
        window.userInfo = this.userInfo
        return this.userInfo
      } catch (error) {
        this.userInfo = {}
        localStorage.removeItem("userInfo")
        toast('用户信息失效')
        throw { message: '用户信息失效' }
      }
    },
    async login() {
      // 获取本地用户信息
      let userInfo = localStorage.getItem("userInfo")
      try {
        if (userInfo !== null) {
          userInfo = JSON.parse(userInfo)
          await this.getUserInfo(userInfo.key)
          return true
        } else {
          throw { message: '用户信息失效' }
        }
      } catch (error) {
        this.showLogin = true
        return new Promise((resolve, reject) => {
          this.loginOnFunc = [resolve, reject]
        })
      }
    },
    loginOut() {
      this.userInfo = {}
      this.showUserInfo = false
      localStorage.removeItem("userInfo")
      this.init()
    },
    async loginInput(value) {
      if (value.length === 36) {
        const userInfo = await this.getUserInfo(value)
        this.loginOnFunc[0] && this.loginOnFunc[0](userInfo)
        this.showLogin = false
      }
    },
    async search(e) {
      const keyWord = e.target.value
      this.malls = await searchQuick({
        url: 'index/search',
        data: {
          keyWord
        }
      })
      this.selectCate = -1
    },
    userShow(type, status, e) {
      if (status) {
        this.showUserInfo = true
        if (this.userShowCloseTimer) {
          clearTimeout(this.userShowCloseTimer)
          this.userShowCloseTimer = null
        }
      } else {
        if (type === 'head') {
          this.userShowCloseTimer = setTimeout(() => { this.showUserInfo = false }, 300)
        } else {
          if (this.userShowCloseTimer) {
            clearTimeout(this.userShowCloseTimer)
            this.userShowCloseTimer = null
          }
          this.userShowCloseTimer = setTimeout(() => { this.showUserInfo = false }, 300)
        }
      }

    },
    switch(index) {
      this.selectCate = index
    },
    filterList() {
      const where = {}
      this.filter.map(item => where[item.name] = item.value)
      return this.malls.filter(item =>
        (where.limit === 0
          || (where.limit >= item.ulimitQty && item.ulimitQty !== 0))
        &&
        (where.time === 'all'
          || item.tmBuyStart.indexOf(where.time) === 11)
      )
    },
    async getMalls() {
      this.malls.splice(0, this.malls.length)
      const cate = this.cates[this.selectCate]
      this.malls = await request({
        url: 'index/malls',
        data: {
          id: cate.brandWindowId || cate.windowId
        }
      })
    },
    stopPropagation(e) {
      e.stopPropagation()
    },
    playVideo(url, e) {
      e && e.stopPropagation()
      this.videoUrl = url
    },
    async showMallDetail(mall) {
      this.selectMall = mall
      this.contentRoutre = 'goods-detail'
    },
    addCart(mall, type = 'add', e) {
      e && (e.stopPropagation(), this.contentRoutre = 'cart')
      if (mall.limitQty === mall.number.daySaleQty && mall.limitQty !== 0) {
        toast('已售完')
        return
      }
      let cartIndex = getInArrayIndex(this.cart, mall.tmBuyStart, 'time')
      if (cartIndex === -1) {
        const time = strToDate(mall.tmBuyStart).getTime()
        const item = {
          time: mall.tmBuyStart,
          timeStamp: time,
          list: [],
          timer: null,
          timeText: '',
          powerID: null
        }
        if (time > (new Date()).getTime()) {
          const { powerSaveBlocker } = require('electron')
          item.timer = new countDown()
          item.timer.onTime(text => item.timeText = text)
          item.timer.onStop(() => {
            item.timer = null
            this.submit()
            powerSaveBlocker.stop(item.powerID)
          })
          item.timer.start(time - 10, 'H时M分S秒', true)
          // 阻止进入省电模式
          item.powerID = powerSaveBlocker.start('prevent-app-suspension')
        }
        this.cart.push(item)
        this.cart.sort((a, b) => a.timeStamp - b.timeStamp)
        cartIndex = getInArrayIndex(this.cart, mall.tmBuyStart, 'time')
      }
      const cartItem = this.cart[cartIndex]
      let mallIndex = getInArrayIndex(cartItem.list, mall.skuSn, 'skuSn')
      if (mallIndex === -1) {
        mallIndex = cartItem.list.length
        cartItem.list.push({ ...mall, qty: 0 })
      }
      const mallItem = cartItem.list[mallIndex]
      if (type === 'add') {
        if (mallItem.ulimitQty !== 0 && mallItem.ulimitQty === mallItem.qty) {
          toast('商品限购：' + mallItem.ulimitQty)
          return
        }
        mallItem.qty++
      } else {
        if (mallItem.qty === 1) {
          // 删除商品
          cartItem.list.splice(mallIndex, 1)
          if (cartItem.list.length === 0) {
            const [item] = this.cart.splice(cartIndex, 1)
            item.timer && item.timer.stop()
          }
          this.cartTotal()
          return
        }
        mallItem.qty--
      }
      this.cartTotal()
    },
    cartTotal() {
      let num = 0
      for (let i = 0; i < this.cart.length; i++) {
        for (let j = 0; j < this.cart[i].list.length; j++) {
          const element = this.cart[i].list[j]
          num += element.qty * element.saleAmt
        }
      }
      this.totalPrice = num
    },
    // 创建订单
    submit() {
      if (this.submitStatus) {
        toast('正在提交中')
        return
      }
      if (this.cart.length === 0) {
        toast('没有要提交的商品')
        return
      }
      const itemList = []
      for (let i = 0, il = this.cart.length; i < il; i++) {
        const list = this.cart[i].list
        // 跳过未开始的商品
        if (this.cart[i].timeStamp > (new Date()).getTime() + 1000) {
          break
        }
        for (let j = 0; j < list.length; j++) {
          const item = list[j]
          itemList.push({
            pai: item.acId,
            q: item.qty,
            sku: item.sku,
            pi: item.prId,
            eskuSn: item.eskuSn,
            pt: 'BRAND_HOUSE',
            title: item.prName
          })
        }
      }
      if (itemList.length === 0) {
        toast('没有要提交的商品')
        return
      }
      this.submitStatus = true
      request({
        url: 'index/submit',
        type: 'POST',
        data: {
          tel: this.userInfo.mobileNo,
          name: this.userInfo.nickName,
          areaId: this.storeInfo.areaId,
          storeId: this.storeInfo.storeId,
          itemList
        }
      }).then(res => {
        this.submitStatus = false
        if (res.error === 0) {
          for (let i = 0; i < this.cart.length; i++) {
            const list = this.cart[i].list
            // 删除已经提交的商品
            if (this.cart[i].timeStamp < (new Date()).getTime()) {
              const item = this.cart.splice(i, 1)
              item.timer && item.timer.stop()
              i--
            }
          }
          this.cartTotal()
          toast('购买成功')
          const myNotification = new Notification('商品购买成功', {
            body: '请在10分钟内前往小程序支付订单'
          })
          myNotification.onclick = () => {
            if (this.contentRoutre === 'order') {
              this.contentRoutre = 'cart'
              setTimeout(() => this.contentRoutre = 'order', 50)
            } else {
              this.contentRoutre = 'order'
            }
          }

        } else {
          toast(res.message)
          new Notification('商品购买失败', {
            body: res.message
          })
        }
      }).catch(err => {
        this.submitStatus = false
      })
    },
    editStore() {
      this.$refs.store.select().then(store => {
        this.storeInfo = store
        window.userInfo.storeInfo = store
      })
    }
  }
})