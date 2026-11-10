const P=(id,n,g,k)=>({id,local_name:n,gender:g,kinship:k||"أخرى",proximity:"A*",alive:k!=="x",favorite:false,locations:[],lastContactDate:null,addedAt:Date.now(),contacts:null,notes:"",linkedTo:null});
const persons=[P("gf","ابوالحسن","male","الجد"),P("gm","زينب","female","الجدة"),P("mgf","احمد","male","الجد لأم"),P("mgm","فاطمة","female","الجدة لأم"),
P("f","محمد","male","الوالد"),P("m","سعاد","female","الوالدة"),P("me","إبتهال","female","نفسي"),P("h","محمد","male","الزوج"),
P("s1","أسماء","female","الأخت"),P("s2","إيمان","female","الأخت"),P("s3","أحمد","male","الأخ"),P("s4","عمر","male","الأخ"),P("s5","خديجة","female","الأخت"),P("s6","يوسف","male","الأخ")];
let n=0;const relations=[];const R=(s,t,ty)=>relations.push({id:"r"+(n++),groupId:"g-1",source:s,target:t,type:ty});
R("gf","gm","spouse");R("mgf","mgm","spouse");R("gf","f","parent");R("gm","f","parent");R("mgf","m","parent");R("mgm","m","parent");R("f","m","spouse");
["me","s1","s2","s3","s4","s5","s6"].forEach(c=>{R("f",c,"parent");R("m",c,"parent");});R("me","h","spouse");
module.exports={persons,relations};
