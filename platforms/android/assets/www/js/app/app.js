App = Ember.Application.create();

var currentUser;

$.requestBackend = function(path, options) {
  if(!options) options = {};

  return $.ajax({
    // url: 'http://localhost:3000' + path,
    url: 'http://backend.claw-studio.com' + path,
    dataType: 'json',
    type: options.type || 'get',
    data: $.extend({ auth_token: currentUser.auth_token }, options.data),
    headers: {
      'Accept': 'application/json'
    }
  });
}

/***********************
 *
 *      Router
 *
 **********************/

App.Router.map(function() {
  this.resource('projects', function() {
    this.route('show', { path: ':project_id' });
  });

  this.resource('audio_sources', function() {
    this.route('show', { path: ':audio_source_id' });
  });
});

/***********************
 *
 *       Routes
 *
 **********************/

App.IndexRoute = Ember.Route.extend({
  model: function() { return currentUser; }
});

App.ProjectsIndexRoute = Ember.Route.extend({
  model: function() {
    var self = this,
        projects = currentUser.get('projects');

    if(projects.get('length')) return projects;

    $.requestBackend('/projects').then(function(data) {
      var controller = self.get('controller');

      data.forEach(function(projectData) {
        var project = App.Project.create(projectData)
        controller.pushObject(project);
      });

      self.set('controller.isLoading', false);
    });

    return projects;
  },

  setupController: function(controller, model) {
    // currentUser.get('projects').clear();
    this._super(controller, model);
  }
});

App.ProjectsShowRoute = Ember.Route.extend({
  model: function(params) {
    var project =
      currentUser.get('projects').findBy('id', parseInt(params.project_id, 10));

    return project;
  },

  setupController: function(controller, model) {
    this._super(controller, model);
    this.set('controller.isLoading', true);
    this.loadDetails(model);
  },

  loadDetails: function(project) {
    var self = this;

    $.requestBackend('/projects/' + project.get('id')).then(function(data) {
      project.setProperties(data);
      self.set('controller.isLoading', false);
    });
  }
});


/***********************
 *
 *     Controllers
 *
 **********************/

App.IndexController = Ember.ObjectController.extend({
  actions: {
    signIn: function() {
      this.sendSignInRequest()
    }
  },

  sendSignInRequest: function() {
    var data = this.serialize();
    var self = this;

    $.requestBackend('/users/sign_in', { type: 'post', data: data })
      .then(function(response) {
        currentUser.setProperties(response)
        currentUser.password = null;
        self.transitionToRoute('/projects')
      });
  },

  serialize: function() {
    return {
      user: {
        email: this.get('email'),
        password: this.get('password')
      }
    };
  }

});

/***********************
 *
 *       Models
 *
 **********************/

App.User = Ember.Object.extend({
  projects: Ember.A()
});
currentUser = App.User.create();

App.Project = Ember.Object.extend({})


