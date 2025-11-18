import { define } from 'typeorm-seeding';
import MissionEntity from '../../entities/mission/mission.entity';
import ProjectEntity from '../../entities/project/project.entity';
import UserEntity from '../../entities/user/user.entity';
import { extendedFaker } from '../../faker-extended';

export interface MissionContext {
    project: ProjectEntity;
    user: UserEntity;
}

define(MissionEntity, (_, context: Partial<MissionContext> = {}) => {
    if (!context.project) {
        throw new Error('Project is required');
    }

    if (!context.user) {
        throw new Error('User is required');
    }

    const mission = new MissionEntity();
    mission.name = extendedFaker.mission.name();
    mission.creator = context.user;
    mission.project = context.project;
    mission.uuid = extendedFaker.string.uuid();
    return mission;
});
