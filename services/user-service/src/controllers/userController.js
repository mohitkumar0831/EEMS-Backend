import * as userService from '../services/userService.js';

export const createEmployee = async (req, res, next) => {
  try {
    const employee = await userService.createEmployee(req.tenant, req.body);
    res.status(201).json({ success: true, message: 'Employee created successfully', data: employee });
  } catch (error) {
    next(error);
  }
};

export const getEmployees = async (req, res, next) => {
  try {
    const employees = await userService.getEmployees(req.tenant);
    res.status(200).json({ success: true, message: 'Employees retrieved successfully', data: employees });
  } catch (error) {
    next(error);
  }
};

export const getEmployeesByManager = async (req, res, next) => {
  try {
    const employees = await userService.getEmployeesByManager(req.tenant, req.params.managerId);
    res.status(200).json({ success: true, message: 'Employees retrieved successfully', data: employees });
  } catch (error) {
    next(error);
  }
};

export const assignManager = async (req, res, next) => {
  try {
    const employee = await userService.assignManager(req.tenant, req.params.employeeId, req.body.managerId);
    res.status(200).json({ success: true, message: 'Manager assigned successfully', data: employee });
  } catch (error) {
    next(error);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const stats = await userService.getDashboardStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};
