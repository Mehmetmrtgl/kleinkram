import { define } from 'typeorm-seeding';
import TagTypeEntity from '../../entities/tagType/tag-type.entity';
import { extendedFaker } from '../../faker-extended';

define(TagTypeEntity, () => {
    const tagType = new TagTypeEntity();

    const [name, datatype, description] = extendedFaker.tagType.tagType();
    tagType.name = name;
    tagType.datatype = datatype;
    tagType.description = description;
    return tagType;
});
