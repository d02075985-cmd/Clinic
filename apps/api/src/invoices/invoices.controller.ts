import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, ParseUUIDPipe, Request, HttpCode } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto';
import { AddChargeDto } from './dto/add-charge.dto';
import { CreateReplacementDto } from './dto/create-replacement.dto';
import { FindInvoicesDto } from './dto/find-invoices.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, InvoiceStatus } from '@prisma/client';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  create(@Request() req, @Body() createInvoiceDto: CreateInvoiceDto) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.invoicesService.create(createInvoiceDto, req.user.id, ipAddress, userAgent);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  findAll(
    @Query() query: FindInvoicesDto,
  ) {
    return this.invoicesService.findAll(
      query.patientId,
      query.status as InvoiceStatus,
      query.page,
      query.limit,
      query.search,
    );
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  updateStatus(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatusDto: UpdateInvoiceStatusDto,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.invoicesService.updateStatus(id, updateStatusDto, req.user.id, req.user.role, ipAddress, userAgent);
  }

  @Post(':id/charges')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @HttpCode(201)
  addCharge(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addChargeDto: AddChargeDto,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.invoicesService.addCharge(id, addChargeDto, req.user.id, req.user.role, ipAddress, userAgent);
  }

  @Post(':id/replacement')
  @Roles(UserRole.ADMIN)
  createReplacement(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createReplacementDto: CreateReplacementDto,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.invoicesService.createReplacement(id, createReplacementDto, req.user.id, req.user.role, ipAddress, userAgent);
  }
}
