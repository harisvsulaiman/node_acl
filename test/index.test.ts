import { assert } from "chai";
import { MongoClient } from "mongodb";
import { Acl, MongoDBBackend } from "../lib";
require("dotenv").config();

const DB = "acltest";
const MONGO_URL = process.env.MONGO_URL;

let connection = null;
let db = null;
let backend = null;

beforeAll(async () => {
  connection = await MongoClient.connect(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  db = await connection.db(DB);

  await db.dropDatabase();
  backend = new MongoDBBackend(db, "acl");
});

afterAll(async () => {
  connection.close();
});

describe("constructor", () => {
  it("should use default `buckets` names", () => {
    let acl = new Acl(backend);

    expect(acl.options.buckets.meta).toBe("meta");
    expect(acl.options.buckets.parents).toBe("parents");
    expect(acl.options.buckets.permissions).toBe("permissions");
    expect(acl.options.buckets.resources).toBe("resources");
    expect(acl.options.buckets.roles).toBe("roles");
    expect(acl.options.buckets.users).toBe("users");
  });

  it("should use given `buckets` names", () => {
    let acl = new Acl(backend, null, {
      buckets: {
        meta: "Meta",
        parents: "Parents",
        permissions: "Permissions",
        resources: "Resources",
        roles: "Roles",
        users: "Users",
      },
    });

    expect(acl.options.buckets.meta).toBe("Meta");
    expect(acl.options.buckets.parents).toBe("Parents");
    expect(acl.options.buckets.permissions).toBe("Permissions");
    expect(acl.options.buckets.resources).toBe("Resources");
    expect(acl.options.buckets.roles).toBe("Roles");
    expect(acl.options.buckets.users).toBe("Users");
  });
});

describe("allow", () => {
  it("guest to view blogs", async () => {
    let acl = new Acl(backend);

    await acl.allow("guest", "blogs", "view");
  });

  it("guest to view forums", async () => {
    let acl = new Acl(backend);

    await acl.allow("guest", "forums", "view");
  });

  it("member to view/edit/delete blogs", async () => {
    let acl = new Acl(backend);

    await acl.allow("guest", "forums", "view");
  });
});

describe("Add user roles", () => {
  it("joed => guest, jsmith => member, harry => admin, test@test.com => member", async () => {
    let acl = new Acl(backend);

    await acl.addUserRoles("joed", "guest");
    await acl.addUserRoles("jsmith", "member");
    await acl.addUserRoles("harry", "admin");
    await acl.addUserRoles("test@test.com", "member");
  });

  it("0 => guest, 1 => member, 2 => admin", async () => {
    let acl = new Acl(backend);

    await acl.addUserRoles(0, "guest");
    await acl.addUserRoles(1, "member");
    await acl.addUserRoles(2, "admin");
  });
});

describe("read User Roles", () => {
  it("run userRoles function", async () => {
    let acl = new Acl(backend);
    await acl.addUserRoles("harry", "admin");

    let roles = await acl.userRoles("harry");
    assert.deepEqual(roles, ["admin"]);

    let is_in_role = await acl.hasRole("harry", "admin");
    assert.ok(is_in_role);
    is_in_role = await acl.hasRole("harry", "no role");
    assert.notOk(is_in_role);
  });
});

describe("read Role Users", () => {
  it("run roleUsers function", async () => {
    let acl = new Acl(backend);
    await acl.addUserRoles("harry", "admin");
    let users = await acl.roleUsers("admin");

    assert.include(users, "harry");
    assert.isFalse("invalid User" in users);
  });
});

describe("allow", () => {
  it("admin view/add/edit/delete users", async () => {
    let acl = new Acl(backend);

    await acl.allow("admin", "users", ["add", "edit", "view", "delete"]);
  });

  it("foo view/edit blogs", async () => {
    let acl = new Acl(backend);

    await acl.allow("foo", "blogs", ["edit", "view"]);
  });

  it("bar to view/delete blogs", async () => {
    let acl = new Acl(backend);

    await acl.allow("bar", "blogs", ["view", "delete"]);
  });
});

describe("add role parents", () => {
  it("add them", async () => {
    let acl = new Acl(backend);

    await acl.addRoleParents("baz", ["foo", "bar"]);
  });
});

describe("add user roles", () => {
  it("add them", async () => {
    let acl = new Acl(backend);

    await acl.addUserRoles("james", "baz");
  });

  it("add them (numeric userId)", async () => {
    let acl = new Acl(backend);

    await acl.addUserRoles(3, "baz");
  });
});

describe("allow admin to do anything", () => {
  it("add them", async () => {
    let acl = new Acl(backend);

    await acl.allow("admin", ["blogs", "forums"], "*");
  });
});

describe("Arguments in one array", () => {
  it("give role fumanchu an array of resources and permissions", async () => {
    let acl = new Acl(backend);

    //@ts-ignore
    await acl.allow([
      {
        roles: "fumanchu",
        allows: [
          { resources: "blogs", permissions: "get" },
          {
            resources: ["forums", "news"],
            permissions: ["get", "put", "delete"],
          },
          {
            resources: ["/path/file/file1.txt", "/path/file/file2.txt"],
            permissions: ["get", "put", "delete"],
          },
        ],
      },
    ]);
  });
});

describe("Add fumanchu role to suzanne", () => {
  it("do it", async () => {
    let acl = new Acl(backend);
    await acl.addUserRoles("suzanne", "fumanchu");
  });
  it("do it (numeric userId)", async () => {
    let acl = new Acl(backend);
    await acl.addUserRoles(4, "fumanchu");
  });
});

describe("Allowance queries", () => {
  describe("isAllowed", () => {
    it("Can joed view blogs?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("joed", "blogs", "view");
      assert(allow);
    });

    it("Can userId=0 view blogs?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed(0, "blogs", "view");

      assert(allow);
    });

    it("Can joed view forums?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("joed", "forums", "view");
      assert(allow);
    });

    it("Can userId=0 view forums?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed(0, "forums", "view");
      assert(allow);
    });

    it("Can joed edit forums?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("joed", "forums", "edit");

      assert(!allow);
    });

    it("Can userId=0 edit forums?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed(0, "forums", "edit");
      assert(!allow);
    });

    it("Can jsmith edit forums?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("jsmith", "forums", "edit");
      assert(!allow);
    });

    it("Can jsmith edit forums?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("jsmith", "forums", "edit");
      assert(!allow);
    });

    it("Can jsmith edit blogs?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("jsmith", "blogs", "edit");
      assert(allow);
    });

    it("Can test@test.com edit forums?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("test@test.com", "forums", "edit");

      assert(!allow);
    });

    it("Can test@test.com edit forums?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("test@test.com", "forums", "edit");
      assert(!allow);
    });

    it("Can test@test.com edit blogs?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("test@test.com", "blogs", "edit");
      assert(allow);
    });

    it("Can userId=1 edit blogs?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed(1, "blogs", "edit");
      assert(allow);
    });

    it("Can jsmith edit, delete and clone blogs?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("jsmith", "blogs", [
        "edit",
        "view",
        "clone",
      ]);
      assert(!allow);
    });

    it("Can test@test.com edit, delete and clone blogs?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("test@test.com", "blogs", [
        "edit",
        "view",
        "clone",
      ]);
      assert(!allow);
    });

    it("Can userId=1 edit, delete and clone blogs?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed(1, "blogs", ["edit", "view", "clone"]);
      assert(!allow);
    });

    it("Can jsmith edit, clone blogs?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("jsmith", "blogs", ["edit", "clone"]);
      assert(!allow);
    });

    it("Can test@test.com edit, clone blogs?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("test@test.com", "blogs", [
        "edit",
        "clone",
      ]);
      assert(!allow);
    });

    it("Can userId=1 edit, delete blogs?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed(1, "blogs", ["edit", "clone"]);
      assert(!allow);
    });

    it("Can james add blogs?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("james", "blogs", "add");
      assert(!allow);
    });

    it("Can userId=3 add blogs?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed(3, "blogs", "add");
      assert(!allow);
    });

    it("Can suzanne add blogs?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("suzanne", "blogs", "add");

      assert(!allow);
    });

    it("Can userId=4 add blogs?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed(4, "blogs", "add");

      assert(!allow);
    });

    it("Can suzanne get blogs?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("suzanne", "blogs", "get");

      assert(allow);
    });

    it("Can userId=4 get blogs?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed(4, "blogs", "get");

      assert(allow);
    });

    it("Can suzanne delete and put news?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("suzanne", "news", ["put", "delete"]);
      assert(allow);
    });

    it("Can userId=4 delete and put news?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed(4, "news", ["put", "delete"]);

      assert(allow);
    });

    it("Can suzanne delete and put forums?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("suzanne", "forums", ["put", "delete"]);
      assert(allow);
    });

    it("Can userId=4 delete and put forums?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed(4, "forums", ["put", "delete"]);
      assert(allow);
    });

    it("Can nobody view news?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("nobody", "blogs", "view");
      assert(!allow);
    });

    it("Can nobody view nothing?", async () => {
      let acl = new Acl(backend);

      let allow = await acl.isAllowed("nobody", "nothing", "view");
      assert(!allow);
    });
  });

  describe("allowedPermissions", () => {
    it("What permissions has james over blogs and forums?", async () => {
      let acl = new Acl(backend);
      let permissions = await acl.allowedPermissions("james", [
        "blogs",
        "forums",
      ]);
      assert.property(permissions, "blogs");
      assert.property(permissions, "forums");

      assert.include(permissions.blogs, "edit");
      assert.include(permissions.blogs, "delete");
      assert.include(permissions.blogs, "view");

      assert(permissions.forums.length === 0);
    });

    it("What permissions has userId=3 over blogs and forums?", async () => {
      let acl = new Acl(backend);
      let permissions = await acl.allowedPermissions(3, ["blogs", "forums"]);

      assert.property(permissions, "blogs");
      assert.property(permissions, "forums");

      assert.include(permissions.blogs, "edit");
      assert.include(permissions.blogs, "delete");
      assert.include(permissions.blogs, "view");

      assert(permissions.forums.length === 0);
    });

    it("What permissions has nonsenseUser over blogs and forums?", async () => {
      let acl = new Acl(backend);
      let permissions = await acl.allowedPermissions("nonsense", [
        "blogs",
        "forums",
      ]);

      assert(permissions.forums.length === 0);
      assert(permissions.blogs.length === 0);
    });
  });
});

describe("whatResources queries", () => {
  it('What resources have "bar" some rights on?', async () => {
    let acl = new Acl(backend);

    let resources = await acl.whatResources("bar");

    assert.include(resources.blogs, "view");
    assert.include(resources.blogs, "delete");
  });

  it('What resources have "bar" view rights on?', async () => {
    let acl = new Acl(backend);

    let resources = await acl.whatResources("bar", "view");

    assert.include(resources, "blogs");
  });

  it('What resources have "fumanchu" some rights on?', async () => {
    let acl = new Acl(backend);

    let resources = await acl.whatResources("fumanchu");

    assert.include(resources.blogs, "get");
    assert.include(resources.forums, "delete");
    assert.include(resources.forums, "get");
    assert.include(resources.forums, "put");
    assert.include(resources.news, "delete");
    assert.include(resources.news, "get");
    assert.include(resources.news, "put");
    assert.include(resources["/path/file/file1.txt"], "delete");
    assert.include(resources["/path/file/file1.txt"], "get");
    assert.include(resources["/path/file/file1.txt"], "put");
    assert.include(resources["/path/file/file2.txt"], "delete");
    assert.include(resources["/path/file/file2.txt"], "get");
    assert.include(resources["/path/file/file2.txt"], "put");
  });

  it('What resources have "baz" some rights on?', async () => {
    let acl = new Acl(backend);

    let resources = await acl.whatResources("baz");
    assert.include(resources.blogs, "view");
    assert.include(resources.blogs, "delete");
    assert.include(resources.blogs, "edit");
  });
});

describe("removeAllow", () => {
  it("Remove get permissions from resources blogs and forums from role fumanchu", async () => {
    let acl = new Acl(backend);
    await acl.removeAllow("fumanchu", ["blogs", "forums"], "get");
  });

  it("Remove delete and put permissions from resource news from role fumanchu", async () => {
    let acl = new Acl(backend);
    await acl.removeAllow("fumanchu", "news", "delete");
  });

  it("Remove view permissions from resource blogs from role bar", async () => {
    let acl = new Acl(backend);
    await acl.removeAllow("bar", "blogs", "view");
  });
});

describe("See if permissions were removed", () => {
  it('What resources have "fumanchu" some rights on after removed some of them?', async () => {
    let acl = new Acl(backend);
    let resources = await acl.whatResources("fumanchu");

    assert.isFalse("blogs" in resources);
    assert.property(resources, "news");
    assert.include(resources.news, "get");
    assert.include(resources.news, "put");
    assert.isFalse("delete" in resources.news);

    assert.property(resources, "forums");
    assert.include(resources.forums, "delete");
    assert.include(resources.forums, "put");
  });
});

describe("removeRole", () => {
  it("Remove role fumanchu", async () => {
    let acl = new Acl(backend);
    await acl.removeRole("fumanchu");
  });

  it("Remove role member", async () => {
    let acl = new Acl(backend);
    await acl.removeRole("member");
  });

  it("Remove role foo", async () => {
    let acl = new Acl(backend);
    await acl.removeRole("foo");
  });
});

describe("Was role removed?", () => {
  it('What resources have "fumanchu" some rights on after removed?', async () => {
    let acl = new Acl(backend);
    let resources = await acl.whatResources("fumanchu");

    assert(Object.keys(resources).length === 0);
  });

  it('What resources have "member" some rights on after removed?', async () => {
    let acl = new Acl(backend);
    let resources = await acl.whatResources("member");

    assert(Object.keys(resources).length === 0);
  });

  describe("allowed permissions", () => {
    it("What permissions has jsmith over blogs and forums?", async () => {
      let acl = new Acl(backend);
      let permissions = await acl.allowedPermissions("jsmith", [
        "blogs",
        "forums",
      ]);

      assert(permissions.blogs.length === 0);
      assert(permissions.forums.length === 0);
    });

    it("What permissions has test@test.com over blogs and forums?", async () => {
      let acl = new Acl(backend);
      let permissions = await acl.allowedPermissions("test@test.com", [
        "blogs",
        "forums",
      ]);

      assert(permissions.blogs.length === 0);
      assert(permissions.forums.length === 0);
    });

    it("What permissions has james over blogs?", async () => {
      let acl = new Acl(backend);
      let permissions = await acl.allowedPermissions("james", "blogs");

      assert.property(permissions, "blogs");
      assert.include(permissions.blogs, "delete");
    });
  });
});

describe("RoleParentRemoval", () => {
  beforeAll(async () => {
    let acl = new Acl(backend);
    await acl.allow("parent1", "x", "read1");
    await acl.allow("parent2", "x", "read2");
    await acl.allow("parent3", "x", "read3");
    await acl.allow("parent4", "x", "read4");
    await acl.allow("parent5", "x", "read5");
    await acl.addRoleParents("child", [
      "parent1",
      "parent2",
      "parent3",
      "parent4",
      "parent5",
    ]);
  });

  let acl;

  beforeEach(async () => {
    acl = new Acl(backend);
  });

  it("Environment check", async () => {
    let resources = await acl.whatResources("child");

    assert.lengthOf(resources.x, 5);
    assert.include(resources.x, "read1");
    assert.include(resources.x, "read2");
    assert.include(resources.x, "read3");
    assert.include(resources.x, "read4");
    assert.include(resources.x, "read5");
  });

  it("Operation uses a callback when removing a specific parent role", async () => {
    await acl.removeRoleParents("child", "parentX");
  });

  it("Operation uses a callback when removing multiple specific parent roles", async () => {
    await acl.removeRoleParents("child", ["parentX", "parentY"]);
  });

  it('Remove parent role "parentX" from role "child"', async () => {
    await acl.removeRoleParents("child", "parentX");
    let resources = await acl.whatResources("child");
    assert.lengthOf(resources.x, 5);
    assert.include(resources.x, "read1");
    assert.include(resources.x, "read2");
    assert.include(resources.x, "read3");
    assert.include(resources.x, "read4");
    assert.include(resources.x, "read5");
  });

  it('Remove parent role "parent1" from role "child"', async () => {
    await acl.removeRoleParents("child", "parent1");
    let resources = await acl.whatResources("child");
    assert.lengthOf(resources.x, 4);
    assert.include(resources.x, "read2");
    assert.include(resources.x, "read3");
    assert.include(resources.x, "read4");
    assert.include(resources.x, "read5");
  });

  it('Remove parent roles "parent2" & "parent3" from role "child"', async () => {
    await acl.removeRoleParents("child", ["parent2", "parent3"]);
    let resources = await acl.whatResources("child");
    assert.lengthOf(resources.x, 2);
    assert.include(resources.x, "read4");
    assert.include(resources.x, "read5");
  });

  it('Remove all parent roles from role "child"', async () => {
    await acl.removeRoleParents("child");
    let resources = await acl.whatResources("child");
    assert.notProperty(resources, "x");
  });

  it('Remove all parent roles from role "child" with no parents', async () => {
    await acl.removeRoleParents("child");
    let resources = await acl.whatResources("child");
    assert.notProperty(resources, "x");
  });

  it('Remove parent role "parent1" from role "child" with no parents', async () => {
    await acl.removeRoleParents("child", "parent1");
    let resources = await acl.whatResources("child");
    assert.notProperty(resources, "x");
  });

  it("Operation uses a callback when removing all parent roles", async () => {
    await acl.removeRoleParents("child");
  });
});

describe("removeResource", () => {
  it("Remove resource blogs", async () => {
    let acl = new Acl(backend);
    await acl.removeResource("blogs");
  });

  it("Remove resource users", async () => {
    let acl = new Acl(backend);
    await acl.removeResource("users");
  });
});

describe("allowedPermissions", () => {
  it("What permissions has james over blogs?", async () => {
    let acl = new Acl(backend);
    let permissions = await acl.allowedPermissions("james", "blogs");

    assert.property(permissions, "blogs");
    assert(permissions.blogs.length === 0);
  });
  it("What permissions has userId=4 over blogs?", async () => {
    let acl = new Acl(backend);
    let permissions = await acl.allowedPermissions(4, "blogs");

    assert.property(permissions, "blogs");
    assert(permissions.blogs.length === 0);
  });
});

describe("whatResources", () => {
  it('What resources have "baz" some rights on after removed blogs?', async () => {
    let acl = new Acl(backend);
    let resources = await acl.whatResources("baz");

    assert.isObject(resources);
    assert(Object.keys(resources).length === 0);
  });

  it('What resources have "admin" some rights on after removed users resource?', async () => {
    let acl = new Acl(backend);
    let resources = await acl.whatResources("admin");
    assert.isFalse("users" in resources);
    assert.isFalse("blogs" in resources);
  });
});

describe("Remove user roles", () => {
  it("Remove role guest from joed", async () => {
    let acl = new Acl(backend);
    await acl.removeUserRoles("joed", "guest");
  });

  it("Remove role guest from userId=0", async () => {
    let acl = new Acl(backend);
    await acl.removeUserRoles(0, "guest");
  });
  it("Remove role admin from harry", async () => {
    let acl = new Acl(backend);
    await acl.removeUserRoles("harry", "admin");
  });

  it("Remove role admin from userId=2", async () => {
    let acl = new Acl(backend);
    await acl.removeUserRoles(2, "admin");
  });
});

describe("Were roles removed?", () => {
  it("What permissions has harry over forums and blogs?", async () => {
    let acl = new Acl(backend);
    let permissions = await acl.allowedPermissions("harry", [
      "forums",
      "blogs",
    ]);

    assert.isObject(permissions);
    assert(permissions.forums.length === 0);
  });

  it("What permissions has userId=2 over forums and blogs?", async () => {
    let acl = new Acl(backend);
    let permissions = await acl.allowedPermissions(2, ["forums", "blogs"]);
    assert.isObject(permissions);
    assert(permissions.forums.length === 0);
  });
});

describe("Github issue #55: removeAllow is removing all permissions.", () => {
  it("Add roles/resources/permissions", async () => {
    let acl = new Acl(backend);

    await acl.addUserRoles("jannette", "member");
    await acl.allow("member", "blogs", ["view", "update"]);

    let allowed = await acl.isAllowed("jannette", "blogs", "view");

    expect(allowed).toBe(true);

    await acl.removeAllow("member", "blogs", "update");

    allowed = await acl.isAllowed("jannette", "blogs", "view");
    expect(allowed).toBe(true);
    allowed = await acl.isAllowed("jannette", "blogs", "update");

    expect(allowed).toBe(false);
    await acl.removeAllow("member", "blogs", "view");

    allowed = await acl.isAllowed("jannette", "blogs", "view");
    expect(allowed).toBe(false);
  });
});

describe('Github issue #32: Removing a role removes the entire "allows" document.', () => {
  it("Add roles/resources/permissions", async () => {
    let acl = new Acl(backend);

    await acl.allow(
      ["role1", "role2", "role3"],
      ["res1", "res2", "res3"],
      ["perm1", "perm2", "perm3"]
    );
  });

  it("Add user roles and parent roles", async () => {
    let acl = new Acl(backend);

    await acl.addUserRoles("user1", "role1");
    await acl.addRoleParents("role1", "parentRole1");
  });

  it("Add user roles and parent roles", async () => {
    let acl = new Acl(backend);

    await acl.addUserRoles(1, "role1");
    await acl.addRoleParents("role1", "parentRole1");
  });

  it("Verify that roles have permissions as assigned", async () => {
    let acl = new Acl(backend);

    let res = await acl.whatResources("role1");
    assert.deepEqual(res.res1.sort(), ["perm1", "perm2", "perm3"]);

    await acl.whatResources("role2");
    assert.deepEqual(res.res1.sort(), ["perm1", "perm2", "perm3"]);
  });

  it('Remove role "role1"', async () => {
    let acl = new Acl(backend);

    await acl.removeRole("role1");
  });

  it('Verify that "role1" has no permissions and "role2" has permissions intact', async () => {
    let acl = new Acl(backend);

    await acl.removeRole("role1");

    let res = await acl.whatResources("role1");
    assert(Object.keys(res).length === 0);

    res = await acl.whatResources("role2");
    assert.deepEqual(res.res1.sort(), ["perm1", "perm2", "perm3"]);
  });
});
