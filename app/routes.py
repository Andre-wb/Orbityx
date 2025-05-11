from flask import render_template, Blueprint, redirect, url_for

main = Blueprint('main', __name__)

@main.route('/')
def introduce_page():
    return render_template('introduce.html', title='Добро пожаловать на Orbityx')

@main.route('/base')
def base_page():
    return render_template('base.html')

@main.route('/currency')
def crypto_currency_page():
    return render_template('crypto_currency.html', title='Актуальный рейтинг криптовалют на Orbityx')