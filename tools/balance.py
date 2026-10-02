"""Турнір ботів для перевірки балансу «Азерот Арени».

Запуск:  python tools/balance.py [раундів_на_пару] [складність 0-2] [спек,спек…]
         (третій аргумент — лише пари з цими спеками, напр. priest або priest/Shadow,mage)
Потрібен Python Playwright і встановлений Chrome.
Друкує: середню тривалість раунду, кількість таймаутів, «спам» (натискань
за хвилину, цифр на секунду) і таблицю перемог/DPS для кожного спеку.
"""
import asyncio, json, pathlib, sys
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent

async def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    skill = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    only = sys.argv[3].split(',') if len(sys.argv) > 3 else []
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome')
        pg = await b.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto((ROOT / 'index.html').as_uri())
        await pg.add_script_tag(path=str(ROOT / 'tools' / 'sim.js'))
        res = await pg.evaluate(f'() => simTournament({{rounds:{n}, skill:{skill}, only:{json.dumps(only)}}})')
        await b.close()
    print(f"матчів: {res['matches']}  середній раунд: {res['avgRound']} с  раундів-таймаутів: {res['timeoutRounds']}")
    print(f"натискань/хв на бійця: {res['avgApm']}  спливних цифр/с: {res['floatsPerSec']}")
    print(f"{'спек':28} {'перемоги%':>9} {'APM':>6} {'DPS':>6}")
    for r in res['rows']:
        print(f"{r['spec']:28} {r['win']:>9} {r['apm']:>6} {r['dps']:>6}")
    if errs:
        print('ПОМИЛКИ:', errs[:5])

asyncio.run(main())
