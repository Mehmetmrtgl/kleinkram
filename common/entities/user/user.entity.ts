import { Column, Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { UserRole } from '../../frontend_shared/enum';
import ActionTemplateEntity from '../action/action-template.entity';
import ActionEntity from '../action/action.entity';
import AccountEntity from '../auth/account.entity';
import ApikeyEntity from '../auth/apikey.entity';
import GroupMembershipEntity from '../auth/group-membership.entity';
import BaseEntity from '../base-entity.entity';
import CategoryEntity from '../category/category.entity';
import FileEntity from '../file/file.entity';
import IngestionJobEntity from '../file/ingestion-job.entity';
import MetadataEntity from '../metadata/metadata.entity';
import MissionEntity from '../mission/mission.entity';
import ProjectEntity from '../project/project.entity';

@Entity({ name: 'user' })
export default class UserEntity extends BaseEntity {
    /**
     * The name of the user. This is the name that will be displayed in the UI.
     * The name gets automatically extracted from the oauth provider.
     *
     * @example 'John Doe'
     */
    @Column()
    name!: string;

    /**
     * The email of the user. This is the email that will be displayed in the UI.
     * The email gets automatically extracted from the oauth provider.
     *
     * @example 'john.doe@example.com'
     *
     * The email is unique and cannot be changed.
     *
     */
    @Column({ unique: true, select: false, update: false })
    email?: string;

    /**
     * The role of the user. The role determines what the user can do in the application.
     *
     * @example 'USER'
     *
     * @see UserRole
     *
     */
    @Column({
        select: true,
        type: 'enum',
        enum: UserRole,
        default: UserRole.USER,
    })
    role?: UserRole;

    /**
     * A hidden user is not returned in any search queries.
     * Hidden users may still be accessed by their UUID (e.g., when
     * listing group memberships).
     *
     */
    @Column({
        select: false,
        default: false,
    })
    hidden?: boolean;

    /**
     * The avatar url of the user. This is the url of the avatar that will be displayed in the UI.
     * The avatar url gets automatically extracted from the oauth provider.
     *
     * @example 'https://example.com/avatar.jpg'
     */
    @Column({ nullable: true })
    avatarUrl?: string;

    @OneToOne(() => AccountEntity, (account) => account.user)
    @JoinColumn({ name: 'account_uuid' })
    account?: AccountEntity;

    @OneToMany(() => GroupMembershipEntity, (membership) => membership.user)
    memberships?: GroupMembershipEntity[];

    @OneToMany(() => ProjectEntity, (project) => project.creator)
    projects?: ProjectEntity[];

    @OneToMany(() => MissionEntity, (mission) => mission.creator)
    missions?: MissionEntity[];

    @OneToMany(() => FileEntity, (file) => file.creator)
    files?: FileEntity[];

    @OneToMany(() => IngestionJobEntity, (queue) => queue.creator)
    queues?: IngestionJobEntity[];

    @OneToMany(() => ActionEntity, (action) => action.mission)
    submittedActions?: ActionEntity[];

    @OneToMany(
        () => ActionTemplateEntity,
        (actionTemplate) => actionTemplate.creator,
    )
    templates?: ActionTemplateEntity[];

    @OneToMany(() => MetadataEntity, (tag) => tag.creator)
    tags?: MetadataEntity[];

    @OneToMany(() => ApikeyEntity, (apikey) => apikey.user)
    api_keys?: ApikeyEntity[];

    @OneToMany(() => CategoryEntity, (category) => category.creator)
    categories?: CategoryEntity[];
}
