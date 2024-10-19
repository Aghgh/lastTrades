async function main() {
  let betCount = 400;

  // bots, sports-bettors, etc.
  let ignoreUsers = ["FDWTsTHFytZz96xmcKzf7S5asYL2", "qnIAzz9RamaodeiJSiGZO6xRGC63" // Yuna , Agh
    ,"Iiok8KHMCRfUiwtMq1tl5PeDbA73", "EJQOCF3MfLTFYbhiKncrNefQDBz1"]; // Lion, chrisjbillington
  // users where you are less likely to benefit from correcting their trades (e.g. good users, news-traders, bots)
  let lessInterestingUsers = ["ilJdhpLzZZSUgzueJOs2cbRnJn82", // Botlab
    "BhNkw088bMNwIFF2Aq5Gg9NTPzz1", "BgCeVUcOzkexeJpSPRNomWQaQaD3", "xB6IgHFizCHEJwqZ3un3", // acc, SemioticRivalry, mattyB
    "JlVpsgzLsbOUT4pajswVMr0ZzmM2", "sTUV8ejuM2byukNZp7qKP2OKXMx2"]; // joshua, NFL Unofficial
  let uninterestingMarkets = [
    "WCsjjEUk1vxRy1wHNi63" // Eliezer UFO bet
    ]; 
  let uninterestingMarketGroups = ["sports-default","sports-betting","auto-racing","one-piece-stocks","stocks"]

  let interestingBetTreshold = 1.7;

  // how significant or exploitable the bet is
  function rateBet(bet) {
    let rating = 0;
    rating += Math.log10(bet._movement * 2 + 0.1);
    rating += Math.log10(bet._absAmount / 10 + 0.1);
    if (uninterestingMarkets.includes(bet.contractId)) { rating -= 1.3; }
    if (lessInterestingUsers.includes(bet.userId)) { rating -= 0.5; }
    if (ignoreUsers.includes(bet.userId)) { rating -= 2; }
    if (bet._unroundedProb === 0.5) { rating -= 2; } // likely the very first bet on a new market
    if (bet.probAfter >= 98.8 || bet.probAfter <= 1.2) { rating -= .5; } // market probably decided already
    if (bet.probAfter > 98.5 || bet.probAfter < 1.5) { rating -= 1.5; } // market probably decided already
    if (bet._isSold && bet._absAmount > 100) { rating += 0.7; } // sells are more likely to be non-epistemic
    if (bet.isApi) { rating -= 0.1; } // bots are harder to exploit
    rating -= bet._ageInMinutes / 60;
    if (bet._ageInMinutes <= 2) { rating += 0.2 }
    if (bet.answerId) { rating -= 0.3; } // personal dislike for multi-choice markets.
    let cachedMarket = globalThis.marketCache[bet.contractId];
    if (cachedMarket) {
      rating-=0.3; //slightly prefer markets I haven't seen before
      rateBetBasedOnMarket(bet);
    }
    return rating;
  }

  function rateBetBasedOnMarket(bet) {
    let cachedMarket = globalThis.marketCache[bet.contractId];
    if (bet._wasRatedBasedOnMarket || !cachedMarket) {
      return;
    } else {
      bet._wasRatedBasedOnMarket = true;
    }
    console.log("rateBetBasedOnMarket ", cachedMarket.question.toLowerCase() )
    if (cachedMarket.isResolved){ bet._significance-=3;}
    if (cachedMarket.question.toLowerCase().includes(" stock")) {bet._significance-=0.1;} // Stocks are boring
    if (cachedMarket.question.includes(" 2030")) {bet._significance-=0.2;}
    if (cachedMarket.uniqueBettorCount<= 5) {bet._significance-=0.5;}
    if (cachedMarket.uniqueBettorCount<= 10) {bet._significance-=0.2;}
     // Left-Wing or Right-Wing? Which person/character/concept will Manifold think are "Right-Wing" this week?"
    if (cachedMarket.question.includes("Which person/character/concept will Manifold think")) {bet._significance-=2;}
    if (cachedMarket.groupSlugs?.some(groupslug=> uninterestingMarketGroups.includes(groupslug))) {bet._significance-=1;}
  }

  function output(...text) {
    outputNode('pre', false, ...text)
  }
  function outputBold(...text) {
    outputNode('pre', true, ...text)
  }
  function outputLink(link, text) {
    outputNode('a', true, link, text)
  }

  function outputNode(node, bold, ...t) {
    const text = t.join('  ');
    console.log(text)
    if (!globalThis.document?.querySelector('#output')) return;
    const newNode = document.createElement(node);
    if (node === 'a') {
      newNode.href = t[0];
      newNode.innerText = t[1];
    } else {
      newNode.innerText = text;
    }

    if (bold) {
      newNode.style.fontWeight = "bold"
    }
    document.querySelector('#output').appendChild(newNode)
  }

  function collectStats(bets) {
    let stats = {
      "amount >=500:": bets.filter(x => (x._absAmount) >= 500).length,
      "amound < 50  ": bets.filter(x => (x._absAmount) < 50).length,
      "movement >=20": bets.filter(x => x._movement >= 20).length,
      "movement <= 1": bets.filter(x => x._movement <= 1).length,
      "firstBet     ": bets.filter(x => x._unroundedProb === 0.5).length,
      "isApi        ": bets.filter(x => x.isApi).length,
      "isSell       ": bets.filter(x => x._isSold).length,
      "isLimitOrder ": bets.filter(x => !x.isFilled).length,
      "decidingBet  ": bets.filter(x => x._probAfter > 98.5 || x._probAfter < 1.5).length,
      "lastMinute   ": bets.filter(x => x._ageInMinutes <= 1).length,
      ">=60minutes  ": bets.filter(x => x._ageInMinutes > 60).length,
      "meh Markets  ": bets.filter(x => uninterestingMarkets.includes(x.contractId)).length,
      "meh Users    ": bets.filter(x => lessInterestingUsers.includes(x.userId)).length,
      "ignoreUsers  ": bets.filter(x => ignoreUsers.includes(x.userId)).length,
      "multi-Market ": bets.filter(x => x.answerId).length,
      "repeat-Market": bets.filter(x => globalThis.marketCache[x.contractId] != null).length,
      "mergedBet    ": bets.filter(x => x.mergeInfo).length,
    }

    for (let stat in stats) {
      stats[stat] = roundTo2(stats[stat] / bets.length)
    }

    stats.nrofbets = bets.length;
    console.log(JSON.stringify(stats, null, 2));
  }

  function roundTo2(num) { return Math.round(num * 100) / 100 }

  // merge consecutive bets regardless of user
  // not sure if this works correctly
  function mergeConsecutiveBets(bets) {
    let aggregatedBets = [];
    for (let i = 0; i < bets.length; i++) {
      let bet = bets[i];
      let mergableBet = aggregatedBets.find((b) => b.contractId == bet.contractId
        && b.answerId == bet.answerId
        && b.outcome == bet.outcome // math for calculating value of merged yes and no bets is too difficult.
        && Math.abs(b._probAfter - bet._probBefore) <= 0.02
      );
      if (mergableBet) {
        mergableBet.mergeInfo = "" + (mergableBet.mergeInfo || Math.round(mergableBet.amount)) +
          " merged with " + Math.round(bet.amount);
        if (mergableBet._absAmount < bet._absAmount) {
          mergableBet.userName = mergableBet.userName || bet.userName
        }
        mergableBet._probAfter = bet._probAfter;
        mergableBet.probAfter = bet.probAfter;
        mergableBet.amount += bet.amount;
        mergableBet._absAmount = Math.abs(bet.amount);
      } else {
        aggregatedBets.push(bet)
      }
    }
    return aggregatedBets;
  }

  globalThis.marketCache = globalThis.marketCache || {}
  async function loadMarket(contractId) {
    let market;
    if (marketCache[contractId]) {
      market = marketCache[contractId]; // save on API-Calls
    } else {
      let response2 = await fetch("https://api.manifold.markets/v0/market/" + contractId, { method: "GET" })
      market = await response2.json();
      marketCache[contractId] = market;
    }
    return market;
  }

  async function outputBetAndMarketInfo(bet) {
    let market = await loadMarket(bet.contractId);

    let realcurrentProb = market.probability && roundTo2(market.probability * 100);
    if (bet.answerId) {
      realcurrentProb = roundTo2(market.answers?.find(a => a.id === bet.answerId)?.probability * 100)
    }
    let answer = bet.answerId ? (market.answers?.find(a => a.id == bet.answerId)?.text) : bet.outcome
    outputLink(market.url, market.question + " (" + answer + ") ")

    if (market.isResolved) {
      outputBold("TOO LATE! market resolved!")
      output(" ");
      return;
    }
    if (realcurrentProb && Math.abs(realcurrentProb - bet._probAfter) > 0.9
      && /*bugfix because sometimes you get the old cached probability*/ realcurrentProb !== bet.probBefore) {
      outputBold("market moved more afterwards, current percentage:",
        realcurrentProb)//, " (_movement:",roundTo2(Math.abs(realcurrentProb-bet.probBefore)),")")
    }
    if (market.uniqueBettorCount <= 10) {
      outputBold("low Trader count market ("+ market.uniqueBettorCount+")!")
    }

    output("amount: ", Math.round(bet._absAmount) + (bet._isSold ? "(sell)" : ""),
      " significance:", roundTo2(bet._significance),)
    output("prob:   ", (bet._probBefore), " -> ", (bet._probAfter),
      (bet._ageInMinutes <= 4) ? "" : (" [placed " + bet._ageInMinutes + " minutes ago]"))
    console.log("user: ", bet.userName || bet.userUsername || bet.userId)

    console.log("marketId",bet.contractId);
    output(" ");
  }

  // START
  try {
    if (globalThis.document?.querySelector('#output')) {
      document.querySelector('#output').innerHTML = "";
    }
    let bets = [];
    const response = await fetch("https://api.manifold.markets/v0/bets?order=desc&limit=" + betCount, { method: "GET" })
    bets = await response.json();
    if (!Array.isArray(bets)) {
      throw "Unknown API-Error";
    }

    output("oldest   Bet:", new Date(bets[bets.length - 1].createdTime).toLocaleTimeString())
    output("youngest Bet:", new Date(bets[0].createdTime).toLocaleTimeString())

    for (let bet of bets) {
      // precalc some stuff 
      bet._isSold = bet.amount < 0;
      bet._unroundedProb = bet.probBefore
      bet._ageInMinutes = Math.floor((new Date() - bet.createdTime) / 1000 / 60)
      bet._absAmount = Math.abs(bet.amount)
      bet._probAfter = roundTo2(bet.probAfter * 100);
      bet._probBefore = roundTo2(bet.probBefore * 100);
      bet._movement = Math.abs(roundTo2((bet.probAfter - bet.probBefore) * 100))
    }
    //collectStats(bets);

    bets = bets.filter(bet => bet._absAmount !== 0);
    console.log("filtered out " + (betCount - bets.length) + " nothing bets")
    let newCount = bets.length
    //let bets2 = mergeConsecutiveBets(bets);
    //output("bets merged "+(newCount - bets2.length));
    bets = mergeConsecutiveBets(bets.reverse());
    console.log("bets merged " + (newCount - bets.length));


    // recalc value that could be changed from merging
    for (let bet of bets) {
      bet._movement = Math.abs(roundTo2((bet._probAfter - bet._probBefore) * 100))
      bet._probAfter = roundTo2(bet.probAfter * 100);
      bet._isSold = bet.amount < 0;
      bet._absAmount = Math.abs(bet.amount)
    }

    for (let bet of bets) {
      bet._significance = rateBet(bet);
    }


    // preload Markets for the most noteworthy bets (in parallel for speed)
    bets = bets.sort((a, b) => b._significance - a._significance);
    const marketsToLoad = Array.from(new Set(bets.slice(0, 8+2).filter(bt => bt._significance > interestingBetTreshold).map(b =>b.contractId)))
    await Promise.all(marketsToLoad.map(id=>loadMarket(id)));

    bets.map(bet=>rateBetBasedOnMarket(bet));
    bets = bets.sort((a, b) => b._significance - a._significance);

    let mostSignificantBet = bets[0]; // biggest bet by _significance

    bets = bets.filter(bt => bt._significance > interestingBetTreshold)

    //collectStats(bets);

    let topX = Math.min(bets.length ,8);

    output("noteworthy bets count:", bets.length, "(out of " + betCount + " total)")
    if (bets.length == 0) {
      outputBold("only boring bets! most significant bet:")
      bets = [mostSignificantBet]
    } else {
      output("TOP " + topX + " bets:")
    }

    bets = bets.slice(0, topX);
    for (let bet of bets) {
      await outputBetAndMarketInfo(bet);
    }
  } catch (e) {
    output(e);
    return;
  }
}
globalThis.document?.getElementById("btn")?.addEventListener("click", () => { main() });
setTimeout(() => main())