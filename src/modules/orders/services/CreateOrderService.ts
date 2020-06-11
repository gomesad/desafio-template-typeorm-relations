import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id || '');

    if (!customer) {
      throw new AppError('User not found');
    }

    const findProductsInStock = await this.productsRepository.findAllById(
      products || ([] as IProduct[]),
    );

    if (findProductsInStock.length !== products.length) {
      throw new AppError('Invalid products');
    }

    if (!findProductsInStock) {
      throw new AppError('Some product not found');
    }

    const productWithInsuficientQuantity = findProductsInStock.filter(p => {
      const indexProductOrder = products.findIndex(
        product => product.id === p.id,
      );
      return products[indexProductOrder].quantity > p.quantity;
    });

    if (productWithInsuficientQuantity.length > 0) {
      throw new AppError('Products with insufficient stock');
    }

    const orderProduct = findProductsInStock.map(p => {
      const indexProductOrder = products.findIndex(
        product => product.id === p.id,
      );
      return {
        product_id: p.id,
        quantity: products[indexProductOrder].quantity,
        price: p.price,
      };
    });

    await this.productsRepository.updateQuantity(products);

    const order = await this.ordersRepository.create({
      customer,
      products: orderProduct,
    });

    const productsWithUpdatedQuantities = findProductsInStock.map(p => {
      const indexProductOrder = products.findIndex(
        product => product.id === p.id,
      );
      return {
        id: p.id,
        quantity: p.quantity - products[indexProductOrder].quantity,
      };
    });

    await this.productsRepository.updateQuantity(productsWithUpdatedQuantities);

    return order;
  }
}

export default CreateOrderService;
