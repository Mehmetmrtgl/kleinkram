import { faker } from '@faker-js/faker';
import { define } from 'typeorm-seeding';
import AccessGroupEntity from '../../entities/auth/accessgroup.entity';
import GroupMembershipEntity from '../../entities/auth/group-membership.entity';
import UserEntity from '../../entities/user/user.entity';
import { extendedFaker } from '../../faker-extended';
import { AccessGroupType } from '../../frontend_shared/enum';

export interface AccessGroupFactoryContext {
    user: UserEntity;
    allUsers: UserEntity[];
    isPersonal: boolean;
}

// @ts-expect-error
define(AccessGroupEntity, (_, context: AccessGroupFactoryContext) => {
    const accessGroup = new AccessGroupEntity();

    if (context.isPersonal) {
        console.assert(
            context.user,
            'No user provided for personal access group',
        );
        accessGroup.name = context.user.name;
        accessGroup.type = AccessGroupType.PRIMARY;
        accessGroup.creator = context.user;

        accessGroup.memberships = [
            {
                user: context.user,
                canEditGroup: false,
            } as GroupMembershipEntity,
        ];
    } else {
        console.assert(
            context.allUsers.length > 0,
            'No users provided for access group',
        );
        accessGroup.name = `Group: ${extendedFaker.company.name()}`;
        accessGroup.type = AccessGroupType.CUSTOM;
        accessGroup.creator = faker.helpers.arrayElement(context.allUsers);

        // add members to group
        accessGroup.memberships = context.allUsers.map(
            (user) =>
                ({
                    user,
                    canEditGroup: user === accessGroup.creator,
                }) as GroupMembershipEntity,
        );
    }

    return accessGroup;
});
