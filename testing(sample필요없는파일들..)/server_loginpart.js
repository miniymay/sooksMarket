var fs = require('fs');
var ejs = require('ejs');
var mysql = require('mysql');
var express = require('express');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var bkfd2Password = require("pbkdf2-password");
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var hasher = bkfd2Password();
var flash = require('connect-flash');
var nodemailer = require('nodemailer');
var smtpTransport = require("nodemailer-smtp-transport");


//DB 설정//
var client = mysql.createConnection({
  host : '203.153.144.75',
  port : 3306,
  user : 'sm14',
  password : 'sm14',
  database : 'sooksmarket'
});
client.connect();

//express 서버객체 생성//
var app = express();

//뷰 엔진 설정//
app.set('views', __dirname);
app.set('view engine', 'ejs');
app.use(session({
    secret: '1234DSFs@adf1234!@#$asd',
    resave: false,
    saveUninitialized: true,
    store: new MySQLStore({
        host: '203.153.144.75',
        port: 3306,
        user: 'sm14',
        password: 'sm14',
        database: 'sooksmarket'
    })
}));

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname));

app.use(passport.initialize());
app.use(passport.session());

//서버 실행
app.listen(80, function(){
  console.log('server running at http://127.0.0.1:80');
});

//아이디 중복체크 함수
var idExistence = -1;

var checkUserId = function(id, callback){
  var column = ['login_id'];
  var tablename = 'Login';

  var exec = client.query('select login_id from Login where login_id='+mysql.escape(id), function(err, rows){
    console.log('실행대상 SQL :' + exec.sql);

    if(rows.length > 0){
      console.log('아이디 [%s]가 일치하는 사용자 찾음',id);
      idExistence = 1;
      callback(null, rows);
    }else{
      idExistence = 0;
      console.log("일치하는 사용자 찾지 못함.");
      callback(null, null);
    }
  });
};


app.get('/', function(request, response){
  console.log("index.ejs 요청됨");
  response.render('index.ejs');
});



////--
app.get('/auth/logout', function(req, res) {
    req.logout();
    req.session.save(function() {
        res.redirect('/sm_main');
    });
});

app.get('/sm_main', function(req, res){
  if (req.user && req.user.displayName) {
  res.render('sm_main.ejs');
  // fs.readFile('sm_main.html', 'utf8', function(error, data){
  //   response.send(data);
  // });
} else {
  res.render('index.ejs')
}
});

passport.serializeUser(function(user, done) {
    console.log('serializeUser', user);
    done(null, user.authId);
});

passport.deserializeUser(function(id, done) {
    console.log('deserializeUser', id);
    var sql='SELECT * FROM users WHERE authId=?';
    client.query(sql,[id],function(err,results){
      if(err){
        console.log(err);
        done('There is no user. ');
      } else{
        done(null,results[0]);
      }
    });
    // for (var i = 0; i < users.length; i++) {
    //     var user = users[i];
    //     if (user.authId === id) {
    //         return done(null, user);
    //     }
    // }
    // done('There is no user.');
});
passport.use(new LocalStrategy(
function(username, password, done) {
    var uname = username;
    var pwd = password;
    var sql = 'SELECT * FROM users WHERE authId=?';
    client.query(sql, ['local:' + uname], function(err, results) {
      console.log(results);
      var user = results[0];
      if (user===undefined) {
          console.log(err);
          return done(null,false);
          //redirect('/')
      }
      console.log(user);

            return hasher({password:pwd, salt:user.salt}, function(err, pass, salt, hash) {
              console.log('salt :',user.salt);
              console.log('password :',pwd);
              console.log('hash :',hash);

                if (hash === user.password) {
                    console.log('LocalStrategy', user);
                     done(null, user);
                } else {
                  console.log('err');
                     done(null, false);
                }
            });
        });
    }
    ));

    app.post(
        '/index',
        passport.authenticate(
            'local', {
                successRedirect: '/sm_main',
                failureRedirect: '/',
                failureFlash: false
            }
        )
    );


app.get('/sm_signup', function(request, response){
  var context = {idExistence : idExistence};
  request.app.render('sm_signup.ejs', context, function(err,html){
    if(err){throw err;}
    response.end(html);
  });
});

app.get('/checkId', function(request, response){
  var id = request.query.id;

  readData(id, function(){
    var context = {userId : id, idExistence : idExistence};
    request.app.render('checkId.ejs', context, function(err,html){
      if(err){throw err;}
      response.end(html);
    });
  });
});

var readData = function(id, callback){
  checkUserId(id, function(err, rows){
    if(err){throw err;}
    callback();
  });
};

var smtpTransport = nodemailer.createTransport(smtpTransport({
  host : "smtp.gmail.com",
  secureConnection : false,
  port : 587,
  auth : {
    user : "miniymay101",
    pass : "sb028390"
  }
}));

var sendCode = function(authenticationCode, email, callback){
  var mailOptions = {
    from: '숙스마켓 <miniymay101@gmail.com>',
    to : email,
    subject: '숙스마켓 인증번호',
    text: '인증 번호 : '+authenticationCode
  };

  smtpTransport.sendMail(mailOptions, function(error, response){
    if(error){
      console.log(error);
    }else{
      console.log("Message sent : " + response.message);
    }
    smtpTransport.close();
    callback();
  });
};

app.get('/authenticateSookmyung', function(request, response){
  var email = request.query.email;
  var authenticationCode = Math.floor(Math.random()*1000000) + 100000;
  console.log(authenticationCode);
  sendCode(authenticationCode, email, function(){
    var context = {userCode : authenticationCode};
    request.app.render('authenticateSookmyung.ejs', context, function(err,html){
      if(err){throw err;}
      response.end(html);
    });
  });
});

app.post('/sm_signup', function(req, res){
  // var body = request.body;
  // client.query('INSERT INTO Login (login_name, login_id, login_password, login_email, login_phone) VALUES (?,?,?,?,?)', [body.name, body.id, body.pw, body.email+"@sm.ac.kr", body.phone], function(){
  //   response.redirect('/');
  // });
  console.log(req.body.password);
  return hasher({password:req.body.password}, function(err, pass, salt, hash) {
    var user = {
        authId: 'local:' + req.body.username,
        username: req.body.username,
        password:hash,
        salt:salt,
        displayName: req.body.displayName,
        login_name : req.body.name,
        login_email : req.body.email+'@sm.ac.kr',
        login_phone : req.body.phone
    };
    console.log('1번' + `${hash}`);
    console.log('1번' + `${salt}`);

    console.log('2번' +user.password);
    console.log('3번' +user.salt);
    //users.push(user);
    var sql = 'INSERT INTO users SET ?';
    client.query(sql, user, function(err, result) {
        if (err) {
            console.log(err);
            res.status(500);
        } else { //바로 로그인 하고 싶을 때 추가!!
            // req.login(user,function(err){
            //   req.session.save(function(){
                 res.redirect('/');
            //   });
            // });
        }
    });
    // req.login(user, function(err){
    //   req.session.save(function(){
    //     res.redirect('/welcome');
    //   });
    // });
});

});

app.get('/sm_addItems', function(request, response){
  fs.readFile('sm_addItems.html', 'utf8', function(error, data){
    response.send(data);
  });
});

app.post('/sm_addItems', function(request, response){
  var body = request.body;
  var way = body.way;
  var category = body.category;
  var photo = body.photo; //photo배열이 만들어짐!!!  console.log(photo[1]);
  var path = "";

  if (way == '직거래'){ value = 1; }
  else if (way == '사물함거래'){ value = 2; }
  else{ value = 3; }

  for(i=0; i<photo.length; i++){
    //client.query('INSERT INTO test2 (product_photo) VALUES (?)', [photo[i]], function(){});
    path = (path+photo[i]);
  }

  client.query('INSERT INTO test2 (product_name, product_price, product_category, product_photo, product_way, product_detail) VALUES (?,?,?,?,?,?)', [body.name, body.price, category, path, value, body.detail], function(){
    response.redirect('/');
  });
});



app.get('/sm_itemDetail', function(request, response){
  fs.readFile('sm_itemDetail.html', 'utf8', function(error, data){
    response.send(data);
  });
});

app.get('/sm_request', function(request, response){
  fs.readFile('sm_request.html', 'utf8', function(error, data){
    response.send(data);
  });
});

app.get('/t_request', function(request, response){
  fs.readFile('t_request.html', 'utf8', function(error, data){
    response.send(data);
  });
});

app.get('/auth/login', function(req, res) {
    var output = `
  <h1>Login</h1>
  <form action="/auth/login" method="post">
    <p>
      <input type="text" name="username" placeholder="username">
    </p>
    <p>
      <input type="password" name="password" placeholder="password">
    </p>
    <p>
      <input type="submit">
    </p>
  </form>
  `;
    res.send(output);
});
