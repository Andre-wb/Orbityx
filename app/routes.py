from flask import render_template, Blueprint, redirect, url_for
from pycoingecko import CoinGeckoAPI
import os

main = Blueprint('main', __name__)

cg = CoinGeckoAPI()


@main.route('/')
def introduce_page():
    return render_template('introduce.html')

@main.route('/base')
def base_page():
    return render_template('base.html')

@main.route('/currency')
def crypto_currency_page():
    coins = cg.get_coins_markets(vs_currency='usd', order='market_cap_desc', per_page=50, page=1)
    return render_template('crypto_currency.html', coins=coins)