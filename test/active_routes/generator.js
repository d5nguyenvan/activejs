ActiveTest.Tests.Routes.generator = function()
{
    with(ActiveTest)
    {
        assert(Controller.home.getUrl() == '/','root route');
        assert(Controller.article.getUrl({id:'5'}) == '/article/5','route with params');
        assert(Controller.wiki.getUrl('/one/two/three') == '/wiki/one/two/three','wildcard route');
        assert(Controller.test.getUrl({
          controller: 'contacts',
          method: 'create',
          id: 5
        }) == '/contacts/create/5','multiple params');
    }
};