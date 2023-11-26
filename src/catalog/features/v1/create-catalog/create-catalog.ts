import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Logger,
    Post,
} from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiProperty,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import mapper from '../../../mappings';
import { Catalog } from '../../../entities/catalog.entity';
import { RabbitmqPublisher } from '../../../../modules/rabbitmq/rabbitmq-publisher';
import { CatalogCreated } from '../../../../contracts/catalog.contracts';
import { CatalogDto } from '../../../dtos/catalog.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export class CreateCatalogDto {
    @ApiProperty()
    name: string;
    @ApiProperty()
    price: number;

    constructor(request: Partial<CreateCatalogDto> = {}) {
        Object.assign(this, request);
    }
}

export class CreateCatalog {
    name: string;
    price: number;

    constructor(request: Partial<CreateCatalog> = {}) {
        Object.assign(this, request);
    }
}

@ApiBearerAuth()
@ApiTags('Catalogs')
@Controller({
    path: `/catalog`,
    version: '1',
})
export class CatalogController {
    constructor(private readonly commandBus: CommandBus) {}

    @Get('brands')
    @ApiOperation({ summary: 'Get Catalog Brands' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({
        status: 200,
        description: 'Catalog Brands',
        type: [CatalogDto],
    })
    async CatalogBrandsAsync(): Promise<CatalogDto[]> {
        Logger.log('CatalogBrandsAsync');
        const brands: Catalog[] = [];

        brands.push({ id: 1, name: '1ABC', price: 12 });
        brands.push({ id: 2, name: '2ABC', price: 13 });
        brands.push({ id: 3, name: '3ABC', price: 14 });
        brands.push({ id: 4, name: '4ABC', price: 15 });

        const catalogDtos = brands.map((brand) =>
            mapper.map<Catalog, CatalogDto>(brand, new CatalogDto()),
        );

        return catalogDtos;
    }

    @Get('exception')
    @ApiOperation({ summary: 'Exception' })
    @ApiResponse({ status: 500, description: 'CustomApiException' })
    @ApiResponse({
        status: 200,
        description: 'No Exception',
        type: Boolean,
    })
    async ExceptionAsync(): Promise<boolean> {
        Logger.log('ExceptionAsync');
        throw new BadRequestException('CustomApiException from ExceptionAsync');
    }

    @Post()
    @ApiOperation({ summary: 'Create Catalog' })
    @ApiResponse({ status: 403, description: 'Forbidden' })
    @ApiResponse({
        status: 201,
        description: 'Created Catalog Successfully',
        type: Boolean,
    })
    async CreateCatalogAsync(
        @Body() createCatalogDto: CreateCatalogDto,
    ): Promise<CatalogDto> {
        Logger.log(
            `createCatalogCommand instanceof CreateCatalogCommand: ${
                createCatalogDto instanceof CreateCatalogDto
            }`,
        );

        const command = mapper.map<CreateCatalogDto, CreateCatalog>(
            createCatalogDto,
            new CreateCatalog(),
        );

        return this.commandBus.execute(command);
    }
}

@CommandHandler(CreateCatalog)
export class CreateCatalogHandler implements ICommandHandler<CreateCatalog> {
    constructor(
        private readonly rabbitmqPublisher: RabbitmqPublisher,
        @InjectRepository(Catalog)
        private readonly catalogRepository: Repository<Catalog>,
    ) {}
    async execute(command: CreateCatalog): Promise<CatalogDto> {
        Logger.log(`Name: ${command.name} | Price: ${command.price}`);

        const catalog = mapper.map<CreateCatalog, Catalog>(
            command,
            new Catalog(),
        );

        const catalogEntity = await this.catalogRepository.save(catalog);

        await this.rabbitmqPublisher.publishMessage(
            new CatalogCreated({
                name: catalogEntity?.name,
                price: catalogEntity?.price,
                id: catalogEntity?.id,
            }),
        );

        const catalogDto = mapper.map<Catalog, CatalogDto>(
            catalogEntity,
            new CatalogDto(),
        );

        return catalogDto;
    }
}
