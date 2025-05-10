import pycoingecko
from flask import Flask, render_template, request, redirect, url_for, send_from_directory

cg = pycoingecko.CoinGeckoAPI()

# Цена монет
price = cg.get_price(ids='XRP', vs_currencies='usd')
print(price)
app = Flask(__name__)

@app.route('/')
def index():
    return f'Цена биткоина {price['bitcoin']['usd']} USD'

if __name__ == '__main__':
    app.run(debug=True)
