// src/controllers/authController.js

exports.login = (req, res) => {
  const { username, password } = req.body;

  if (username === 'admin' && password === 'ant.design') {
    return res.json({
      status: 'ok',
      type: 'account',
      currentAuthority: 'admin',
    });
  }

  return res.json({
    status: 'error',
    type: 'account',
    currentAuthority: 'guest',
    msg: '账号或密码错误'
  });
};

exports.getCurrentUser = (req, res) => {
  res.json({
    data: {
      name: 'Serati Ma',
      avatar: 'https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png',
      userid: '00000001',
      email: 'antdesign@alipay.com',
      signature: '海纳百川，有容乃大',
      title: '交互专家',
      group: '蚂蚁金服－某某某事业群－某某平台部－UED',
      tags: [
        { key: '0', label: '很有想法的' },
        { key: '1', label: '专注设计' },
        { key: '2', label: '辣~' },
        { key: '3', label: '大长腿' },
        { key: '4', label: '川妹子' },
        { key: '5', label: '海纳百川' },
      ],
      notifyCount: 12,
      unreadCount: 11,
      country: 'China',
      geographic: {
        province: { label: '浙江省', key: '330000' },
        city: { label: '杭州市', key: '330100' },
      },
      address: '西湖区工专路 77 号',
      phone: '0752-268888888',
    }
  });
};

exports.getRules = (req, res) => {
  res.json({
    data: [
      {
        key: 99,
        disabled: false,
        href: 'https://ant.design',
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/udxAbMEhpwthVVcjLXik.png',
        name: 'TradeCode 99',
        owner: '曲丽丽',
        desc: '这是一段描述',
        callNo: 503,
        status: '0',
        updatedAt: '2022-12-06T05:00:57.040Z',
        createdAt: '2022-12-06T05:00:57.040Z',
        progress: 81,
      },
      {
        key: 98,
        disabled: false,
        href: 'https://ant.design',
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/eeHMaZBwmTvLdIwMfBpg.png',
        name: 'TradeCode 98',
        owner: '曲丽丽',
        desc: '这是一段描述',
        callNo: 164,
        status: '0',
        updatedAt: '2022-12-06T05:00:57.040Z',
        createdAt: '2022-12-06T05:00:57.040Z',
        progress: 12,
      },
      {
        key: 97,
        disabled: false,
        href: 'https://ant.design',
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/udxAbMEhpwthVVcjLXik.png',
        name: 'TradeCode 97',
        owner: '曲丽丽',
        desc: '这是一段描述',
        callNo: 174,
        status: '1',
        updatedAt: '2022-12-06T05:00:57.040Z',
        createdAt: '2022-12-06T05:00:57.040Z',
        progress: 81,
      },
      {
        key: 96,
        disabled: true,
        href: 'https://ant.design',
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/eeHMaZBwmTvLdIwMfBpg.png',
        name: 'TradeCode 96',
        owner: '曲丽丽',
        desc: '这是一段描述',
        callNo: 914,
        status: '0',
        updatedAt: '2022-12-06T05:00:57.040Z',
        createdAt: '2022-12-06T05:00:57.040Z',
        progress: 7,
      },
      {
        key: 95,
        disabled: false,
        href: 'https://ant.design',
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/udxAbMEhpwthVVcjLXik.png',
        name: 'TradeCode 95',
        owner: '曲丽丽',
        desc: '这是一段描述',
        callNo: 698,
        status: '2',
        updatedAt: '2022-12-06T05:00:57.040Z',
        createdAt: '2022-12-06T05:00:57.040Z',
        progress: 82,
      },
      {
        key: 94,
        disabled: false,
        href: 'https://ant.design',
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/eeHMaZBwmTvLdIwMfBpg.png',
        name: 'TradeCode 94',
        owner: '曲丽丽',
        desc: '这是一段描述',
        callNo: 488,
        status: '1',
        updatedAt: '2022-12-06T05:00:57.040Z',
        createdAt: '2022-12-06T05:00:57.040Z',
        progress: 14,
      },
      {
        key: 93,
        disabled: false,
        href: 'https://ant.design',
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/udxAbMEhpwthVVcjLXik.png',
        name: 'TradeCode 93',
        owner: '曲丽丽',
        desc: '这是一段描述',
        callNo: 580,
        status: '2',
        updatedAt: '2022-12-06T05:00:57.040Z',
        createdAt: '2022-12-06T05:00:57.040Z',
        progress: 77,
      },
    ],
    total: 100,
    success: true,
    pageSize: 20,
    current: 1,
  });
};

exports.logout = (req, res) => {
  res.json({ data: {}, success: true });
};

