const express = require('express');
const path = require('path');
const routes = require('./routes')
const app = express();
const port = process.env.PORT;

app.use(express.json());
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "public")));

routes.register(app);

app.listen(port ?? 8080, () => {
     // tslint:disable-next-line:no-console
    console.log('server started');
});
