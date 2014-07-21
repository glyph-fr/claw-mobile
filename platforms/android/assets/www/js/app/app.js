App = Ember.Application.create();

window.currentUser = null;

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


Ember.Application.initializer({
  name: 'currentUser',

  initialize: function(container) {
    container.register('currentUser:main', currentUser, { instantiate: false });
    container.typeInjection('controller', 'currentUser', 'currentUser:main');
    container.typeInjection('route', 'currentUser', 'currentUser:main');
    container.typeInjection('helper', 'currentUser', 'currentUser:main');
  }
});

Ember.Object.reopen({
  clearProperties: function() {
    for(var key in this) {
      if(this.hasOwnProperty(key) && typeof this.get(key) !== 'function') {
        this.set(key, null);
      }
    }
  }
});

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
  model: function() { return currentUser; },

  setupController: function(controller, model) {
    if (this.get('currentUser.isSignedIn')) this.transitionTo('projects');

    this._super(controller, model);
  }
});

App.AuthenticatedRoute = Ember.Route.extend({
  beforeModel: function() {
    if(!this.get('currentUser.isSignedIn')) {
      this.transitionToRoute('index');
      return false;
    }
  }
})

App.ProjectsIndexRoute = App.AuthenticatedRoute.extend({
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

App.ProjectsShowRoute = App.AuthenticatedRoute.extend({
  model: function(params) {
    var self = this,
        project_id = parseInt(params.project_id, 10),
        project = currentUser.get('projects').findBy('id', project_id);

    if(!project) {
      project = App.Project.create();

      $.requestBackend('/projects/' + params.project_id).then(function(data) {
        project.setProperties(data);
        self.set('controller.isLoading', false);
      });
    }

    return project;
  },

  setupController: function(controller, model) {
    this._super(controller, model);
    this.set('controller.isLoading', true);
    if(model) this.loadDetails(model);
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

App.ApplicationController = Ember.ObjectController.extend({
  actions: {
    signOut: function() {
      this.get('currentUser').signOut();
      this.transitionToRoute('index');
    }
  }
});

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
        localStorage.setItem('clawCurrentUser', JSON.stringify(response))
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

App.DiscussionController = Ember.ObjectController.extend({
  currentUser: function() {
    return window.currentUser;
  }.property(),

  author: function() {
    return window.currentUser.getContact(this.get('author_id'));
  }.property('currentUser.contacts.[]'),

  createdAtString: function() {
    var a, value = this.get('created_at');

    if (typeof value === 'string') {
        a = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-])(\d{2,}):(\d{2,})?$/.exec(value);
        console.log(value, a)
    }

    return a[3] + "/" + a[2] + "/" + a[1] + " - " + a[4] + ":" + a[5];

  }.property('created_at')
});

/***********************
 *
 *       Models
 *
 **********************/

App.User = Ember.Object.extend({
  projects: Ember.A(),
  contacts: Ember.Object.create(),

  isSignedIn: function() {
    return this.get('auth_token');
  }.property('auth_token'),

  signInFromLocalStorage: function() {
    var userData = localStorage.getItem('clawCurrentUser');

    if(userData) {
      this.setProperties(JSON.parse(userData));
    }
  },

  signOut: function() {
    this.clearProperties();
    localStorage.removeItem('clawCurrentUser');
  },

  getContact: function(authorId) {
    var contact;

    if(authorId == this.get('id')) return this;

    if(contact = this.get('contacts.' + authorId)) return contact;

    contact = App.Contact.create();
    this.set('contacts.' + authorId, contact)

    this.loadContacts();

    return contact;
  },

  loadContacts: function() {
    if(this.get('loadingContacts')) return;

    var self = this;

    this.set('loadingContacts', true);

    $.requestBackend('/contacts').then(function(contactsData) {
      contactsData.forEach(function(contactData) {
        var contact = self.get('contacts.' + contactData.id);

        console.log('Contact ?', contact)
        if(!contact) {
          contact = App.Contact.create();
          self.set('contacts.' + contactData.id, contact);
        }
        contact.setProperties(contactData);
      });

      self.set('loadingContacts', false);
    });
  }
});
currentUser = App.User.create();
currentUser.signInFromLocalStorage();

App.Project = Ember.Object.extend({});

App.Contact = Ember.Object.extend({});

/***********************
 *
 *       Views
 *
 **********************/

Ember.View.reopen({
  touchStart: Ember.aliasMethod('click')
});
