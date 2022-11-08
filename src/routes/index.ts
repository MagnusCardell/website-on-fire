const register = (app:any) => {
    app.get("/", (req: any, res: any) => {
        res.render("index", {
            title: 'Magnus Cardell'
        });
    });
};
module.exports = { register };