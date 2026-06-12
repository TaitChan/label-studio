import { types } from "mobx-state-tree";
import { User } from "./Users";
import { StringOrNumberID } from "./types";
import { FF_DISABLE_GLOBAL_USER_FETCHING, isFF } from "../utils/feature-flags";

function hasMeaningfulUserProperties(user) {
  return Boolean(user?.firstName || user?.email || user?.username || user?.lastName);
}

function inlineUserFromId(userId, extra = {}) {
  return {
    id: userId,
    firstName: extra.firstName ?? "",
    lastName: extra.lastName ?? "",
    username: extra.username ?? extra.email ?? `user_${userId}`,
    email: extra.email ?? "",
    lastActivity: extra.lastActivity ?? "",
    initials: extra.initials ?? "?",
    avatar: extra.avatar ?? null,
  };
}

function resolveAssigneeUser(userId, extraUser = {}) {
  if (isFF(FF_DISABLE_GLOBAL_USER_FETCHING)) {
    return hasMeaningfulUserProperties(extraUser)
      ? inlineUserFromId(userId, extraUser)
      : inlineUserFromId(userId);
  }

  return userId;
}

// Create a union type that can handle both user references and direct user objects
const UserOrReference = types.union({
  dispatcher: (snapshot) => {
    // If it's a full user object (has firstName, email, etc.), use User model
    if (snapshot && typeof snapshot === "object" && (snapshot.firstName || snapshot.email || snapshot.username)) {
      return User;
    }
    // Otherwise, it's a reference to a user ID
    return types.reference(User);
  },
  cases: {
    [User.name]: User,
    reference: types.reference(User),
  },
});

export const Assignee = types
  .model("Assignee", {
    id: StringOrNumberID,
    user: types.late(() => UserOrReference),
    review: types.maybeNull(types.enumeration(["accepted", "rejected", "fixed"])),
    reviewed: types.maybeNull(types.boolean),
    annotated: types.maybeNull(types.boolean),
  })
  .views((self) => ({
    get firstName() {
      return self.user.firstName;
    },
    get lastName() {
      return self.user.lastName;
    },
    get username() {
      return self.user.username;
    },
    get email() {
      return self.user.email;
    },
    get lastActivity() {
      return self.user.lastActivity;
    },
    get avatar() {
      return self.user.avatar;
    },
    get initials() {
      return self.user.initials;
    },
    get fullName() {
      return self.user.fullName;
    },
  }))
  .preProcessSnapshot((sn) => {
    let result = sn;

    if (typeof sn === "number") {
      result = {
        id: sn,
        user: resolveAssigneeUser(sn),
        annotated: true,
        review: null,
        reviewed: false,
      };
    } else {
      const { user_id, annotated, review, reviewed, ...user } = sn;
      const id = user_id ?? sn.id;

      result = {
        id,
        user: resolveAssigneeUser(id, user),
        annotated,
        review,
        reviewed,
      };
    }

    return result;
  });
