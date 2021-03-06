/**
  ACL System inspired on Zend_ACL.

  All functions accept strings, objects or arrays unless specified otherwise.

  '*' is used to express 'all'

  Database structure in Redis (using default prefix 'acl')

  Users:

  acl_roles_{userid} = set(roles)

  Roles:

  acl_roles = {roleNames} // Used to remove all the permissions associated to ONE resource.

  acl_parents_{roleName} = set(parents)
  acl_resources_{roleName} = set(resourceNames)

  Permissions:

  acl_allows_{resourceName}_{roleName} = set(permissions)

  Note: user ids, role names and resource names are all case sensitive.

  Roadmap:
    - Add support for locking resources. If a user has roles that gives him permissions to lock
      a resource, then he can get exclusive write operation on the locked resource.
      This lock should expire if the resource has not been accessed in some time.
*/
import _ from "lodash";
import Backend from "./backend";

type Options = {
  buckets: {
    meta: string;
    parents: string;
    permissions: string;
    resources: string;
    roles: string;
    users: string;
  };
};

type UserID = string | number;
type Role = string;
type Roles = Array<Role>;
type Permission = string;
type Permissions = Array<Permission>;
type Resource = string;
type Resources = Array<Resource>;

export class Acl {
  backend: Backend;
  options: Options;
  logger: any = null;

  constructor(backend: Backend, logger?: any, options?: Options) {
    options = {
      buckets: {
        meta: "meta",
        parents: "parents",
        permissions: "permissions",
        resources: "resources",
        roles: "roles",
        users: "users",
      },
      ...options,
    };

    this.logger = logger;
    this.backend = backend;
    this.options = options;
  }

  /**
    addUserRoles( userId, roles, function(err) )

    Adds roles to a given user id.

    @param {String|Number} User id.
    @param {String|Array} Role(s) to add to the user id.
    @param {Function} Callback called when finished.
    @return {Promise} Promise resolved when finished
  */
  async addUserRoles(userId: UserID, roles: Roles | Role) {
    let transaction = await this.backend.begin();

    await this.backend.add(
      transaction,
      this.options.buckets.meta,
      "users",
      userId
    );
    await this.backend.add(
      transaction,
      this.options.buckets.users,
      userId,
      roles
    );

    if (Array.isArray(roles)) {
      await Promise.all(
        roles.map(async (role) => {
          await this.backend.add(
            transaction,
            this.options.buckets.roles,
            role,
            userId
          );
        })
      );
    } else {
      await this.backend.add(
        transaction,
        this.options.buckets.roles,
        roles,
        userId
      );
    }

    return await this.backend.end(transaction);
  }

  /**
    removeUserRoles( userId, roles, function(err) )

    Remove roles from a given user.

    @param {String|Number} User id.
    @param {String|Array} Role(s) to remove to the user id.
    @param {Function} Callback called when finished.
    @return {Promise} Promise resolved when finished
  */
  async removeUserRoles(userId: UserID, roles: Roles | Role) {
    // contract(arguments)
    //   .params("string|number", "string|array", "function")
    //   .params("string|number", "string|array")
    //   .end();

    let transaction = await this.backend.begin();
    await this.backend.remove(
      transaction,
      this.options.buckets.users,
      userId,
      roles
    );

    if (Array.isArray(roles)) {
      roles.forEach(async (role) => {
        await this.backend.remove(
          transaction,
          this.options.buckets.roles,
          role,
          userId
        );
      });
    } else {
      await this.backend.remove(
        transaction,
        this.options.buckets.roles,
        roles,
        userId
      );
    }

    return await this.backend.end(transaction);
  }

  /**
    userRoles( userId, function(err, roles) )

    Return all the roles from a given user.

    @param {String|Number} User id.
    @param {Function} Callback called when finished.
    @return {Promise} Promise resolved with an array of user roles
  */
  async userRoles(userId) {
    return await this.backend.get(this.options.buckets.users, userId);
  }

  /**
      roleUsers( roleName, function(err, users) )

      Return all users who has a given role.
      @param {String|Number} rolename.
      @param {Function} Callback called when finished.
      @return {Promise} Promise resolved with an array of users
   */
  async roleUsers(roleName) {
    return await this.backend.get(this.options.buckets.roles, roleName);
  }

  /**
    hasRole( userId, rolename, function(err, is_in_role) )

    Return boolean whether user is in the role

    @param {String|Number} User id.
    @param {String|Number} rolename.
    @param {Function} Callback called when finished.
    @return {Promise} Promise resolved with boolean of whether user is in role
  */
  async hasRole(userId, rolename) {
    let roles = await this.userRoles(userId);
    return await roles.includes(rolename);
  }

  /**
    addRoleParents( role, parents, function(err) )

    Adds a parent or parent list to role.

    @param {String} Child role.
    @param {String|Array} Parent role(s) to be added.
    @param {Function} Callback called when finished.
    @return {Promise} Promise resolved when finished
  */
  async addRoleParents(role, parents) {
    // contract(arguments)
    //   .params("string|number", "string|array", "function")
    //   .params("string|number", "string|array")
    //   .end();

    let transaction = await this.backend.begin();
    await this.backend.add(
      transaction,
      this.options.buckets.meta,
      "roles",
      role
    );

    await this.backend.add(
      transaction,
      this.options.buckets.parents,
      role,
      parents
    );
    return await this.backend.end(transaction);
  }

  /**
    removeRoleParents( role, parents, function(err) )

    Removes a parent or parent list from role.

    If `parents` is not specified, removes all parents.

    @param {String} Child role.
    @param {String|Array} Parent role(s) to be removed [optional].
    @param {Function} Callback called when finished [optional].
    @return {Promise} Promise resolved when finished.
  */
  async removeRoleParents(role, parents) {
    // contract(arguments)
    //   .params("string", "string|array", "function")
    //   .params("string", "string|array")
    //   .params("string", "function")
    //   .params("string")
    //   .end();

    let transaction = await this.backend.begin();
    if (parents) {
      await this.backend.remove(
        transaction,
        this.options.buckets.parents,
        role,
        parents
      );
    } else {
      await this.backend.del(transaction, this.options.buckets.parents, role);
    }
    return await this.backend.end(transaction);
  }

  /**
    removeRole( role, function(err) )

    Removes a role from the system.

    @param {String} Role to be removed
    @param {Function} Callback called when finished.
  */
  async removeRole(role) {
    // contract(arguments).params("string", "function").params("string").end();

    // Note that this is not fully transactional.
    let resources = await this.backend.get(
      this.options.buckets.resources,
      role
    );
    let transaction = await this.backend.begin();

    resources.forEach(async (resource) => {
      const bucket = allowsBucket(resource);
      await this.backend.del(transaction, bucket, role);
    });

    await this.backend.del(transaction, this.options.buckets.resources, role);
    await this.backend.del(transaction, this.options.buckets.parents, role);
    await this.backend.del(transaction, this.options.buckets.roles, role);
    await this.backend.remove(
      transaction,
      this.options.buckets.meta,
      "roles",
      role
    );

    // `users` collection keeps the removed role
    // because we don't know what users have `role` assigned.
    return await this.backend.end(transaction);
  }

  /**
    removeResource( resource, function(err) )

    Removes a resource from the system

    @param {String} Resource to be removed
    @param {Function} Callback called when finished.
    @return {Promise} Promise resolved when finished
  */
  async removeResource(resource) {
    // contract(arguments).params("string", "function").params("string").end();

    let roles = await this.backend.get(this.options.buckets.meta, "roles");

    let transaction = await this.backend.begin();
    await this.backend.del(transaction, allowsBucket(resource), roles);

    roles.forEach(async (role) => {
      await this.backend.remove(
        transaction,
        this.options.buckets.resources,
        role,
        resource
      );
    });
    return await this.backend.end(transaction);
  }

  /**
    allow( roles, resources, permissions, function(err) )

    Adds the given permissions to the given roles over the given resources.

    @param {String|Array} role(s) to add permissions to.
    @param {String|Array} resource(s) to add permisisons to.
    @param {String|Array} permission(s) to add to the roles over the resources.
    @param {Function} Callback called when finished.

    allow( permissionsArray, function(err) )

    @param {Array} Array with objects expressing what permissions to give.

    [{roles:{String|Array}, allows:[{resources:{String|Array}, permissions:{String|Array}]]

    @param {Function} Callback called when finished.
    @return {Promise} Promise resolved when finished
  */

  async allow(roles, resources, permissions) {
    if (!resources && !permissions) {
      return await this._allowEx(roles);
    } else {
      roles = makeArray(roles);
      resources = makeArray(resources);

      let transaction = await this.backend.begin();

      await this.backend.add(
        transaction,
        this.options.buckets.meta,
        "roles",
        roles
      );

      resources.forEach(async (resource) => {
        roles.forEach(async (role) => {
          await this.backend.add(
            transaction,
            allowsBucket(resource),
            role,
            permissions
          );
        });
      });

      roles.forEach(async (role) => {
        await this.backend.add(
          transaction,
          this.options.buckets.resources,
          role,
          resources
        );
      });

      return await this.backend.end(transaction);
    }
  }

  async removeAllow(role, resources, permissions) {
    resources = makeArray(resources);
    permissions = makeArray(permissions);

    return await this.removePermissions(role, resources, permissions);
  }

  /**
    removePermissions( role, resources, permissions)

    Remove permissions from the given roles owned by the given role.

    Note: we loose atomicity when removing empty role_resources.

    @param {String}
    @param {String|Array}
    @param {String|Array}
  */
  async removePermissions(role, resources, permissions) {
    let transaction = await this.backend.begin();

    resources.forEach(async (resource) => {
      const bucket = allowsBucket(resource);

      if (permissions) {
        await this.backend.remove(transaction, bucket, role, permissions);
      } else {
        await this.backend.del(transaction, bucket, role);
        await this.backend.remove(
          transaction,
          this.options.buckets.resources,
          role,
          resource
        );
      }
    });

    // Remove resource from role if no rights for that role exists.
    // Not fully atomic...
    await this.backend.end(transaction);

    const second_transaction = await this.backend.begin();
    await Promise.all(
      resources.map(async (resource) => {
        const bucket = allowsBucket(resource);
        let { length } = await this.backend.get(bucket, role);

        if (length == 0) {
          await this.backend.remove(
            second_transaction,
            this.options.buckets.resources,
            role,
            resource
          );
        }
      })
    );
    return await this.backend.end(second_transaction);
  }

  /**
    allowedPermissions( userId, resources, function(err, obj) )

    Returns all the allowable permissions a given user have to
    access the given resources.

    It returns an array of objects where every object maps a
    resource name to a list of permissions for that resource.

    @param {String|Number} User id.
    @param {String|Array} resource(s) to ask permissions for.
    @param {Function} Callback called when finished.
  */
  async allowedPermissions(userId, resources) {
    if (!userId) return {};

    if (this.backend.unions) {
      return await this.optimizedAllowedPermissions(userId, resources);
    }

    resources = makeArray(resources);

    let roles = await this.userRoles(userId);
    let result: any = {};

    await Promise.all(
      resources.map(async (resource) => {
        let permissions = await this._resourcePermissions(roles, resource);
        result[resource] = permissions;
      })
    );

    return result;
  }

  /**
    optimizedAllowedPermissions( userId, resources, function(err, obj) )

    Returns all the allowable permissions a given user have to
    access the given resources.

    It returns a map of resource name to a list of permissions for that resource.

    This is the same as allowedPermissions, it just takes advantage of the unions
    function if available to reduce the number of backend queries.

    @param {String|Number} User id.
    @param {String|Array} resource(s) to ask permissions for.
    @param {Function} Callback called when finished.
  */
  async optimizedAllowedPermissions(userId, resources) {
    if (!userId) {
      return {};
    }

    resources = makeArray(resources);

    let roles = await this._allUserRoles(userId);
    const buckets = resources.map(allowsBucket);

    let response = null;
    if (roles.length === 0) {
      const emptyResult = {};
      buckets.forEach((bucket) => {
        emptyResult[bucket] = [];
      });
      response = emptyResult;
    }

    response = await this.backend.unions(buckets, roles);

    const result = {};
    Object.keys(response).forEach((bucket) => {
      result[keyFromAllowsBucket(bucket)] = response[bucket];
    });

    return result;
  }

  /**
    isAllowed( userId, resource, permissions, function(err, allowed) )

    Checks if the given user is allowed to access the resource for the given
    permissions (note: it must fulfill all the permissions).

    @param {String|Number} User id.
    @param {String|Array} resource(s) to ask permissions for.
    @param {String|Array} asked permissions.
    @param {Function} Callback called wish the result.
  */
  async isAllowed(userId, resource, permissions) {
    let roles = await this.backend.get(this.options.buckets.users, userId);
    if (roles.length) {
      return await this.areAnyRolesAllowed(roles, resource, permissions);
    } else {
      return false;
    }
  }

  /**
    areAnyRolesAllowed( roles, resource, permissions, function(err, allowed) )

    Returns true if any of the given roles have the right permissions.

    @param {String|Array} Role(s) to check the permissions for.
    @param {String} resource(s) to ask permissions for.
    @param {String|Array} asked permissions.
    @param {Function} Callback called with the result.
  */
  async areAnyRolesAllowed(roles, resource, permissions) {
    roles = makeArray(roles);
    permissions = makeArray(permissions);

    if (roles.length === 0) {
      return false;
    } else {
      return await this._checkPermissions(roles, resource, permissions);
    }
  }

  /**
    whatResources(role, function(err, {resourceName: [permissions]})

    Returns what resources a given role or roles have permissions over.

    whatResources(role, permissions, function(err, resources) )

    Returns what resources a role has the given permissions over.

    @param {String|Array} Roles
    @param {String|Array} Permissions
    @param {Function} Callback called wish the result.
  */
  async whatResources(
    roles: Roles | Role,
    permissions?: Permissions | Permission
  ) {
    roles = makeArray(roles);
    if (permissions) {
      permissions = makeArray(permissions);
    }

    return await this.permittedResources(roles, permissions);
  }

  async permittedResources(roles, permissions) {
    const result: any = _.isUndefined(permissions) ? {} : [];
    let resources: Resources = await this._rolesResources(roles);

    await Promise.all(
      resources.map(async (resource) => {
        let resourcePermissions = await this._resourcePermissions(
          roles,
          resource
        );

        if (permissions) {
          const commonPermissions = _.intersection(
            permissions,
            resourcePermissions
          );
          if (commonPermissions.length > 0) {
            // TODO: Add test case
            //@ts-ignore Property 'push' does not exist on type '{}'.ts(2339)
            result.push(resource);
          }
        } else {
          result[resource] = resourcePermissions;
        }
      })
    );

    return result;
  }

  //-----------------------------------------------------------------------------
  //
  // Private methods
  //
  //-----------------------------------------------------------------------------

  //
  // Same as allow but accepts a more compact input.
  //
  private async _allowEx(objs) {
    objs = makeArray(objs);

    const demuxed = [];
    objs.forEach((obj) => {
      const roles = obj.roles;
      obj.allows.forEach(({ resources, permissions }) => {
        demuxed.push({
          roles,
          resources,
          permissions,
        });
      });
    });

    await demuxed.reduce(async (values, { roles, resources, permissions }) => {
      return await this.allow(roles, resources, permissions);
    }, Promise.resolve(null));
  }

  //
  // Returns the parents of the given roles
  //
  private async _rolesParents(roles) {
    return await this.backend.union(this.options.buckets.parents, roles);
  }

  //
  // Return all roles in the hierarchy including the given roles.
  //
  private async _allRoles(roleNames) {
    let parents = await this._rolesParents(roleNames);

    if (parents.length > 0) {
      let parentRoles = await this._allRoles(parents);
      return _.union(roleNames, parentRoles);
    } else {
      return roleNames;
    }
  }

  //
  // Return all roles in the hierarchy of the given user.
  //
  private async _allUserRoles(userId) {
    let roles = await this.userRoles(userId);

    if (roles && roles.length > 0) {
      return await this._allRoles(roles);
    } else {
      return [];
    }
  }

  //
  // Returns an array with resources for the given roles.
  //
  private async _rolesResources(roles) {
    roles = makeArray(roles);

    let allRoles = await this._allRoles(roles);
    let result = [];

    await Promise.all(
      allRoles.map(async (role) => {
        let resources = await this.backend.get(
          this.options.buckets.resources,
          role
        );

        result = result.concat(resources);
      })
    );

    return result;
  }

  //
  // Returns the permissions for the given resource and set of roles
  //
  private async _resourcePermissions(roles, resource) {
    if (roles.length === 0) {
      return [];
    } else {
      let resourcePermissions = await this.backend.union(
        allowsBucket(resource),
        roles
      );

      let parents = await this._rolesParents(roles);

      if (parents && parents.length) {
        let morePermissions = await this._resourcePermissions(
          parents,
          resource
        );

        return _.union(resourcePermissions, morePermissions);
      } else {
        return resourcePermissions;
      }
    }
  }

  //
  // NOTE: This function will not handle circular dependencies and result in a crash.
  //
  private async _checkPermissions(roles, resource, permissions) {
    let resourcePermissions = await this.backend.union(
      allowsBucket(resource),
      roles
    );

    if (resourcePermissions.includes("*")) {
      return true;
    } else {
      permissions = permissions.filter((p) => {
        return resourcePermissions.indexOf(p) === -1;
      });

      if (permissions.length === 0) {
        return true;
      } else {
        let parents = await this.backend.union(
          this.options.buckets.parents,
          roles
        );

        if (parents && parents.length) {
          return await this._checkPermissions(parents, resource, permissions);
        } else {
          return false;
        }
      }
    }
  }
}

//-----------------------------------------------------------------------------
//
// Helpers
//
//-----------------------------------------------------------------------------

function makeArray(arr) {
  return Array.isArray(arr) ? arr : [arr];
}

function allowsBucket(role) {
  return `allows_${role}`;
}

function keyFromAllowsBucket(str) {
  return str.replace(/^allows_/, "");
}

// -----------------------------------------------------------------------------------
