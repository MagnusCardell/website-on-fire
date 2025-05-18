const register = (app:any) => {
    app.get("/", (req: any, res: any) => {
        res.render("index", {
            title: 'Magnus Cardell'
        });
    });
    app.get("/tba", (req: any, res: any) => {
        res.render("tba", {
            title: 'Magnus Cardell'
        });
    });
};
module.exports = { register };