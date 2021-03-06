var settings = require("./settings.json");


class Commodity {
    constructor(data) {
        // todo
        this.name = data.name;
        this.size = data.size;
    }
}
class Inventory {
    constructor(commodities) {
        this.stuff = commodities.stuff;
        this.maxSize = commodities.maxSize;
        // commodities.forEach(function(commodity){
        //   this.stuff[commodity.name] = {
        //     ideal: commodity.ideal,
        //     size: commodity.size,
        //     amount: commodity.start
        //   }
        // },this);
    }
    list() {
        var arr = [];
        for (var commodity in this.stuff) {
            arr.push(commodity);
        }
        return arr;
    }
    getAmountOf(commodity) {
        if (this.getItem(commodity) !== undefined) {
            return this.getItem(commodity).amount;
        } else {
            return 0;
        }
    }
    getItem(commodity) {
        return this.stuff[commodity];
    }
    getSpaceUsed() {
        var spaceUsed = 0;
        for (var item in this.stuff) {
            spaceUsed += this.stuff[item].size;
        }
        return spaceUsed;
    }
    getSpaceEmpty() {
        return this.maxSize - this.getSpaceUsed();
    }
    surplus(commodity) {
        var com = this.stuff[commodity];
        if (com.amount > com.ideal) {
            return com.amount - com.ideal;
        }
        return 0;
    }
    shortage(commodity) {
        var com = this.stuff[commodity];
        if (com.amount < com.ideal) {
            return com.ideal - com.amount;
        }
        return 0;
    }
}
class Offer {
    constructor(agentId, commodity, amount, price) {
        this.agentId = agentId;
        this.commodity = commodity;
        this.amount = amount;
        this.pricePerUnit = price;
    }
    toString() {
        return (
            "(" +
            this.agentId +
            "): " +
            this.commodity +
            " x " +
            this.amount +
            " @ " +
            this.pricePerUnit
        );
    }
}
class LogicAction {
    constructor(data) {
        this.action = "";
        this.targets = [];
        this.amounts = [];
        this.chances = [];
        this.efficiency = [];
        this.results = [];
        this.data = data;

        for (var str in data) {
            var lstr = str.toLowerCase();
            switch (lstr) {
                case "produce":
                    this.action = "produce";
                    this.targets = data.produce;
                    break;
                case "consume":
                    this.action = "consume";
                    this.targets = data.consume;
                    break;
                case "transform":
                    this.action = "transform";
                    this.targets = data.transform;
                    break;
                case "amount":
                    this.amounts = [];
                    var list_amounts = data[str];
                    for (var val in list_amounts) {
                        if (typeof val === "string" && val == "all") {
                            this.amounts.push(-1); //-1 means 'all', negative values are strictly reserved for this
                            //sign is already implied by 'produce/consume/transform' etc
                        } else {
                            this.amounts.push(list_amounts[val]);
                        }
                    }
                    break;
                case "chance":
                    this.chances = data[str];
                    break;
                case "efficiency":
                    this.efficiency = data[str];
                    break;
                case "into":
                    this.results = data[str];
                    break;
            }
        }

        if (this.amounts == null) {
            this.amounts = [];
        }
        if (this.chances == null) {
            this.chances = [];
        }

        if (this.action == "transform") {
            if (this.efficiency == null) {
                this.efficiency = [];
            }
        }

        for (var i = 0; i < this.targets.length; i++) {
            if (i > this.amounts.length - 1) {
                this.amounts.push(1); //if item is specified but amount is not, amount is 1
            }
            if (i > this.chances.length - 1) {
                this.chances.push(1); //if item is specified but chance is not, chance is 1
            }
            if (this.action == "transform") {
                if (i > this.efficiency.length - 1) {
                    this.efficiency.push(1); //if item is specified but efficiency is not, efficiency is 1
                }
            }
        }
    }
}
class LogicCondition {
    constructor(str) {
        this.negated = false;
        if (str.substr(0, 1) === "!") {
            this.negated = true;
            str = str.substr(1, str.length - 1);
        }
        this.condition = str;
    }
}

class LogicNode {
    constructor(data) {
        this.isLeaf = false; //if it's a leaf node, it should only have actions
        //if it's a branch node, it should only have conditions/params

        this.params = null;
        this.nodeTrue = null;
        this.nodeFalse = null;
        this.actions = null;

        if (data !== null) {
            if (data.hasOwnProperty("condition")) {
                this.isLeaf = false;

                var listConditions = data.condition;
                this.conditions = [];
                for (var condition in listConditions) {
                    this.conditions.push(new LogicCondition(listConditions[condition]));
                }
                this.params = data.param;
                if (data.hasOwnProperty("if_true")) {
                    this.nodeTrue = new LogicNode(data.if_true);
                }
                if (data.hasOwnProperty("if_false")) {
                    this.nodeFalse = new LogicNode(data.if_false);
                }
            } else {
                this.isLeaf = true;
                var listActions = data.action;
                this.actions = [];
                for (var action in listActions) {
                    this.actions.push(new LogicAction(listActions[action]));
                }
            }
        }
    }
}
class Logic {
    constructor(data) {
        this.src = JSON.stringify(data);
        this.root = new LogicNode(data);
    }

    getProduction(commodity, currentNode) {
        if (currentNode === null) {
            return this.getProduction(commodity, root);
        } else {
            if (!currentNode.isLeaf) {
                var a = this.getProduction(commodity, currentNode.nodeTrue);
                var b = this.getProduction(commodity, currentNode.nodeFalse);
                return a + b;
            } else {
                var amount = 0;
                currentNode.actions.forEach(function(act) {
                    for (var i = 0; i < act.targets.length; i++) {
                        switch (act.action) {
                            case "produce":
                                if (act.targets[i] === commodity) {
                                    amount += act.chances[i] * act.amounts[i];
                                }
                                break;
                            case "transform":
                                var amt = act.amounts[i];
                                if (amt === -1) {
                                    amt = 1;
                                } //wtf??
                                if (act.results[i] === commodity) {
                                    amount += act.chances[i] * amt * act.efficiency[i];
                                }
                                break;
                        }
                    }
                });
                return amount;
            }
        }
        return 0;
    }

    perform(agent, currentNode) {
        if (!currentNode.isLeaf) {
            if (this.evaluate(agent, currentNode)) {
                if (currentNode.nodeTrue !== null) {
                    this.perform(agent, currentNode.nodeTrue);
                }
            } else {
                if (currentNode.nodeFalse !== null) {
                    this.perform(agent, currentNode.nodeFalse);
                }
            }
        } else {
            currentNode.actions.forEach(function(act) {
                for (var i = 0; i < act.targets.length; i++) {
                    var amount = act.amounts[i];
                    var target = act.targets[i];
                    var chance = act.chances[i];

                    //Roll to see if this happens
                    if (chance >= 1.0 || Math.random() < chance) {
                        var amt = agent.inventory.stuff[target].amount;

                        if (amount === -1) {
                            //-1 means 'match my total value'
                            amount = amt;
                        }

                        switch (act.action) {
                            case "produce":
                                agent.inventory.stuff[target].amount += amount;
                                break;
                            case "consume":
                                agent.inventory.stuff[target].amount -= amount;
                                break;
                            case "transform":
                                var amountTarget = amount;
                                //exchange rate between A -> B
                                var amountProduct = amount * act.efficiency[i];
                                var result = act.results[i];

                                agent.inventory.stuff[target].amount -= amountTarget; //consume this much of A
                                agent.inventory.stuff[result].amount += amountProduct; //produce this much of B
                                break;
                        }
                    }
                }
            });
        }
    }

    evaluate(agent, currentNode) {
        currentNode.conditions.forEach(function(c) {
            switch (c.condition) {
                case "has": //Do you have something?
                    var str,
                        has = false;
                    currentNode.params.forEach(function(commodity) {
                        var amount = agent.inventory.getAmountOf(commodity);
                        if (amount > 0) {
                            has = true;
                        }
                        if (c.negated) {
                            if (has) {
                                return false;
                            }
                        } else {
                            if (!has) {
                                return false;
                            }
                        }
                    }, agent);
                    break;
            }
        }, (agent, currentNode));
        return true;
    }
}
class Role {
    constructor(data) {
        function parseData() {}

        this.id = data.id;
        this.inventory = (function(data) {
            var inv = {
                stuff: {},
                maxSize: data.inventory.max_size
            };
            for (var com in data.inventory.start) {
                inv.stuff[com] = {};
                inv.stuff[com].amount = data.inventory.start[com];
            }
            for (var comm in data.inventory.ideal) {
                inv.stuff[comm].ideal = data.inventory.ideal[comm];
            }
            return inv;
        })(data);

        this.money = data.money;
        this.logic = new Logic(data.logic);
    }
    getStartInventory() {
        var i = new Inventory(this.inventory);
        return i;
    }
}
class Agent {
    constructor(data, market) {
        this.role = new Role(data);
        this.cash = this.role.money;
        this._cash = 0;
        this.destroyed = false;
        this.market = market
        this.id = this.market.agents.length + 1;

        // add only own commodities to inventory
        // function getInventory(){
        //   var inv = {};
        //   for (var need in data.needs){
        //     inv[need] = {
        //       amount: 0,
        //       size: market.getCommodity(need).size,
        //       ideal: data.needs[need]
        //     };

        //   }
        //   for (var product in data.produce){
        //     inv[product] = {
        //       amount: 0,
        //       size: market.getCommodity(product).size,
        //       ideal: data.produce[product]
        //     };
        //   }
        //   return new Inventory(inv);
        // }

        this.inventory = this.role.getStartInventory(); // new Inventory(commodities)
        this.priceBeliefs = {
            // "commodity": {x:price * 0.5,y:price * 1.5}
        };
        this.observedTradingRange = {
            // "commodity": [price,price,price etc..]
        };
        // set init values to 0
        for (var commodity in this.inventory.stuff) {
            this.inventory.stuff[commodity].size = parseInt(
                this.market.getCommodity(commodity).size
            );
            this.priceBeliefs[commodity] = {
                x: 1,
                y: 10
            };
            this.observedTradingRange[commodity] = [4];
        }
    }
    generateOffers(market, commodity) {
        var offer,
            surplus = this.inventory.surplus(commodity);

        if (surplus >= 1) {
            offer = this.createAsk(commodity, 1 /* <-why is this here? */ );
            if (offer !== null) {
                market.ask(offer);
            }
        } else {
            var shortage = this.inventory.shortage(commodity),
                space = this.inventory.getSpaceEmpty(),
                unit_size = this.inventory.getItem(commodity).size;

            if (shortage > 0 && space >= unit_size) {
                var limit = 0;
                if (shortage * unit_size <= space) {
                    //enough space for ideal order
                    limit = shortage;
                } else {
                    // not enough space
                    limit = Math.floor(space / shortage);
                }

                if (limit > 0) {
                    offer = this.createBid(commodity, limit);
                    if (offer !== null) {
                        market.bid(offer);
                    }
                }
            }
        }
    }
    updatePriceModel(market, act, commodity, success, unitPrice) {
        var // Statics
            SIGNIFICANT = 0.25,
            SIG_IMBALANCE = 0.33,
            LOW_INVENTORY = 0.1,
            HIGH_INVENTORY = 2.0,
            MIN_PRICE = 0.01;

        var observedTrades = this.observedTradingRange[commodity],
            publicMeanPrice = market.getAvgPrice(commodity),
            belief = this.priceBeliefs[commodity],
            mean = (belief.x + belief.y) / 2,
            wobble = 0.05,
            deltaToMean = mean - publicMeanPrice;

        if (success) {
            observedTrades.push(unitPrice);
            if (act == "buy" && deltaToMean > SIGNIFICANT) {
                //overpaid
                belief.x -= deltaToMean / 2; // SHIFT towards mean
                belief.y -= deltaToMean / 2;
            } else if (act == "sell" && deltaToMean < -SIGNIFICANT) {
                //undersold
                belief.x -= deltaToMean / 2; // SHIFT towards mean
                belief.y -= deltaToMean / 2;
            }

            belief.x += wobble * mean; //increase the belief's certainty
            belief.y -= wobble * mean;
        } else {
            belief.x -= deltaToMean / 2;
            belief.y -= deltaToMean / 2;

            var specialCase = false,
                stocks = this.inventory.stuff[commodity].amount,
                ideal = this.inventory.stuff[commodity].ideal;

            if (act == "buy" && stocks < LOW_INVENTORY * ideal) {
                //very low on inventory AND can'ecoMarket buy
                wobble *= 2;
                specialCase = true;
            } else if (act == "sell" && stocks > HIGH_INVENTORY * ideal) {
                //very high stock of commodity AND can'ecoMarket sell
                wobble *= 2;
                specialCase = true;
            }

            if (!specialCase) {
                var asks = market.history.asks[commodity].slice(-1)[0],
                    bids = market.history.bids[commodity].slice(-1)[0],
                    supplyVSdemand = (asks - bids) / (asks + bids);

                if (supplyVSdemand > SIG_IMBALANCE || supplyVSdemand < -SIG_IMBALANCE) {
                    //too much supply: lower price
                    //too much demand: raise price

                    var newMean = publicMeanPrice * (1 - supplyVSdemand);
                    deltaToMean = mean - newMean;

                    belief.x -= deltaToMean / 2;
                    belief.y -= deltaToMean / 2;
                }
            }

            belief.x -= wobble * mean; //decrease the belief's certainty
            belief.y += wobble * mean;
        }

        if (belief.x < MIN_PRICE) {
            belief.x = MIN_PRICE;
        } else if (belief.y < MIN_PRICE) {
            belief.y = MIN_PRICE;
        }
    }
    getTradePoint(commodity) {
        var arr = this.observedTradingRange[commodity],
            point = {
                x: Math.min.apply(Math, arr),
                y: Math.max.apply(Math, arr)
            };
        return point;
    }
    determinePrice(commodity) {
        var belief = this.priceBeliefs[commodity];
        return Math.random() * (belief.y - belief.x) + belief.x;
    }
    positionInRange(val, min, max, clamp) {
        val -= min;
        max -= min;
        min = 0;
        val = val / (max - min);
        if (clamp) {
            if (val < 0) {
                val = 0;
            }
            if (val > 1) {
                val = 1;
            }
        }
        return val;
    }
    determinePurchaseQty(commodity) {
        // 1. mean -> historical mean price of commodity
        // 2. favorability -> *max price* position of mean within observed trading range
        // 3. amount to sell -> favorability * available inventory space
        // 4. return amount to sell
        var mean = this.market.getAvgPrice(commodity),
            tradingRange = this.getTradePoint(commodity);

        if (tradingRange !== null) {
            var favorability = this.positionInRange(
                mean,
                tradingRange.x,
                tradingRange.y,
                true
            );
            favorability = 1 - favorability;
            //do 1 - favorability to see how close we are to the low end

            var amountToBuy = Math.round(
                favorability * this.inventory.shortage(commodity)
            );
            if (amountToBuy < 1) {
                amountToBuy = 1;
            }
            return amountToBuy;
        }
        return 0;
    }
    determineSaleQty(commodity) {
        var mean = this.market.getAvgPrice(commodity),
            tradingRange = this.getTradePoint(commodity);

        if (tradingRange !== null) {
            var favorability = this.positionInRange(
                mean,
                tradingRange.x,
                tradingRange.y,
                true
            );

            var amountToSell = Math.round(
                favorability * this.inventory.surplus(commodity)
            );
            if (amountToSell < 1) {
                amountToSell = 1;
            }
            return amountToSell;
        }
        return 0;
    }
    createBid(commodity, limit) {
        // Bid to purchase a _limit_ of _commodity_        --#page 4
        var price = this.determinePrice(commodity),
            ideal = this.determinePurchaseQty(commodity),
            qtyToBuy = (function() {
                if (ideal > limit) {
                    return limit;
                } else {
                    return ideal;
                }
            })();
        if (qtyToBuy > 0) {
            return new Offer(this.id, commodity, qtyToBuy, price);
        }
        return null;
    }
    createAsk(commodity, limit) {
        // Ask to sell at least _limit_ of _commodity_     --#page 4
        var price = this.determinePrice(commodity),
            ideal = this.determineSaleQty(commodity),
            qtyToSell = (function() {
                if (ideal < limit) {
                    return limit;
                } else {
                    return ideal;
                }
            })();

        if (qtyToSell > 0) {
            return new Offer(this.id, commodity, qtyToSell, price);
        }

        return null;
    }
    produce(commodity) {}
    updatePriceBelief(commodity) {
        var price = this.market.getAvgPrice(commodity);
        this.priceBeliefs[commodity] = {
            x: price * 0.5,
            y: price * 1.5
        };
    }
}
class Economia {
    constructor(data) {
        this.books = {
            asks: {},
            bids: {}
        };
        this.history = {
            price: {},
            asks: {},
            bids: {},
            trades: {},
            profitability: {}
        };
        this.commodities = Array();
        for (var _commodity in data.commodities) {
            var commodity = data.commodities[_commodity];
            this.addCommodity(commodity);
        }
        this.agents = Array();

        this.roles = {};
        data.roles.map(function(role) {
            this.roles[role.id] = {
                id: role.id,
                inventory: role.inventory,
                logic: role.logic,
                money: role.money
            };
            this.history.profitability[role.id] = [];
        }, this);

        for (var role in data.start_conditions.agents) {
            var amount = data.start_conditions.agents[role];
            for (var i = 0; i <= amount; i++) {
                this.agents.push(new Agent(this.roles[role], this));
            }
        }
    }
    shuffle(collection) {
        for (var i = 0; i < collection.length; i++) {
            var ii = collection.length - 1 - i;
            if (ii > 1) {
                var j = Math.floor(Math.random() * (ii - 1));
                var temp = collection[j];
                collection[j] = collection[ii];
                collection[ii] = temp;
            }
        }
        return collection;
    }
    sortHighestPrice(collection) {}
    getAgent(agentId) {
        var result = this.agents.filter(function(el) {
            return el.id == agentId;
        });
        if (result.length == 1) return result[0];
    }
    addCommodity(commodity) {
        this.commodities.push(new Commodity(commodity));
        this.books.asks[commodity.name] = Array();
        this.books.bids[commodity.name] = Array();
        this.history.price[commodity.name] = Array(1, 1.2, 1.3); //dummy float to avoid division by zero
        this.history.asks[commodity.name] = Array();
        this.history.bids[commodity.name] = Array();
        this.history.trades[commodity.name] = Array();
    }
    getCommodity(commodity) {
        var result = this.commodities.filter(function(el) {
            return el.name == commodity;
        });
        if (result.length == 1) return result[0];
    }
    getAvgPrice(commodity) {
        var arr = this.history.price[commodity],
            sum = 0,
            avg;
        for (var i = 0; i < arr.length; i++) {
            sum += arr[i];
        }
        if (sum !== 0) {
            avg = sum / arr.length;
        } else {
            avg = 0;
        }
        return avg;
    }
    bid(offer) {
        this.books.bids[offer.commodity].push(offer);
    }
    ask(offer) {
        this.books.asks[offer.commodity].push(offer);
    }
    resolveOffers(commodity) {
        var bids = this.books.bids[commodity],
            asks = this.books.asks[commodity];

        this.shuffle(bids);
        this.shuffle(asks);

        bids.sort(function(a, b) {
            // Highest PPU to lowest
            if (a.pricePerUnit < b.pricePerUnit) return 1;
            if (a.pricePerUnit > b.pricePerUnit) return -1;
            return 0;
        });
        asks.sort(function(a, b) {
            // Lowest PPU to highest
            if (a.pricePerUnit > b.pricePerUnit) return 1;
            if (a.pricePerUnit < b.pricePerUnit) return -1;
            return 0;
        });

        var stats = {
            successfulTrades: 0,
            moneyTraded: 0,
            unitsTraded: 0,
            avgPrice: 0,
            numAsks: 0,
            numBids: 0
        };

        var failsafe = 0;

        bids.forEach(function(bid) {
            stats.numBids += bid.amount;
        });
        asks.forEach(function(ask) {
            stats.numAsks += ask.amount;
        });

        while (bids.length > 0 && asks.length > 0) {
            var buyer = bids[0],
                seller = asks[0],
                qtyTraded = Math.min(seller.amount, buyer.amount),
                clearingPrice = (seller.pricePerUnit + buyer.pricePerUnit) / 2;

            if (qtyTraded > 0) {
                seller.amount -= qtyTraded;
                buyer.amount -= qtyTraded;

                this.transferCommodity(
                    commodity,
                    qtyTraded,
                    seller.agentId,
                    buyer.agentId
                );
                this.transferMoney(
                    qtyTraded * clearingPrice,
                    seller.agentId,
                    buyer.agentId
                );

                var buyerAgent = this.getAgent(buyer.agentId),
                    sellerAgent = this.getAgent(seller.agentId);

                buyerAgent.updatePriceModel(
                    this,
                    "buy",
                    commodity,
                    true,
                    clearingPrice
                );
                sellerAgent.updatePriceModel(
                    this,
                    "sell",
                    commodity,
                    true,
                    clearingPrice
                );

                //log statistics

                stats.moneyTraded += qtyTraded * clearingPrice;
                stats.unitsTraded += qtyTraded;
                stats.successfulTrades++;
            }

            if (seller.amount === 0) {
                //seller is out of offered good
                asks.splice(0, 1); //remove offer
                failsafe = 0;
            }
            if (buyer.amount === 0) {
                //buyer has bought all he needs
                bids.splice(0, 1); //remove offer
                failsafe = 0;
            }

            failsafe++;

            if (failsafe > 1000) {
                console.log("something went wrong");
            }
        }

        //reject remaining offers and update price beliefs

        while (bids.length > 0) {
            var buyer = bids[0],
                buyerAgent = this.getAgent(buyer.agentId);

            buyerAgent.updatePriceModel(this, "buy", commodity, false);
            bids.splice(0, 1);
        }
        while (asks.length > 0) {
            var seller = asks[0],
                sellerAgent = this.getAgent(seller.agentId);

            sellerAgent.updatePriceModel(this, "sell", commodity, false);
            asks.splice(0, 1);
        }

        //update history

        this.history.bids[commodity].push(stats.numBids);
        this.history.asks[commodity].push(stats.numAsks);
        this.history.trades[commodity].push(stats.unitsTraded);

        if (stats.unitsTraded > 0) {
            stats.avgPrice = stats.moneyTraded / stats.unitsTraded;
            this.history.price[commodity].push(stats.avgPrice);
        } else {
            //special case: none were traded this round, use last round's avg price
            var arr = this.history.price[commodity];
            stats.avgPrice = arr[arr.length - 1];
            this.history.price[commodity].push(stats.avgPrice);
        }
    }
    getHistoryAvg(mode, commodity, range) {
        var arr = this.history[mode][commodity],
            newArr = arr.slice(arr.length - (range - 1)),
            sum = 0,
            avg;
        for (var i = 0; i < newArr.length; i++) {
            sum += newArr[i];
        }
        if (sum !== 0) {
            avg = sum / newArr.length;
        } else {
            avg = 0;
        }
        return avg;
    }
    getHistoryProfitAvg(role, range) {
        var arr = this.history.profitability[role],
            newArr = arr.slice(arr.length - (range - 1)),
            sum = 0,
            avg;
        for (var i = 0; i < newArr.length; i++) {
            sum += newArr[i];
        }
        if (sum !== 0) {
            avg = sum / newArr.length;
        } else {
            avg = 0;
        }
        return avg;
    }
    getBestMarketOpportunity() {
        var bestMarket = "",
            bestRatio = -999999,
            minimum = 1.5;
        this.commodities.forEach(function(commodity) {
            var asks = this.getHistoryAvg("asks", commodity.name, 10),
                bids = this.getHistoryAvg("bids", commodity.name, 10),
                ratio = 0;

            if (asks === 0 && bids > 0) {
                ratio = 999999999999;
            } else {
                ratio = bids / asks;
            }

            console.log(commodity.name, ratio);

            if (ratio > minimum && ratio > bestRatio) {
                bestRatio = ratio;
                bestMarket = commodity.name;
            }
        }, this);

        return bestMarket;
    }
    getMostProfitableRole() {
        var list,
            best = -99999,
            bestRole = "";
        for (var role in this.roles) {
            var val = this.getHistoryProfitAvg(role, 10);
            if (val > best) {
                bestRole = role;
                best = val;
            }
        }
        return bestRole;
    }
    getRoleThatMakesMostOf(commodity) {
        var bestAmount = 0,
            bestRole = "";

        for (var role in this.roles) {
            var arr = this.agents.filter(function(agent) {
                return agent.role.id == role;
            }, role);
            var logic = arr[0].role.logic;
            console.log(logic); //return the first agent to match;
            var amount = logic.getProduction(commodity, logic.root);
            if (amount > bestAmount) {
                bestAmount = amount;
                bestRole = role;
            }
        }

        return bestRole;
    }
    replaceAgent(agent) {
        var bestRole = this.getMostProfitableRole();
        //Special case to deal with very high demand-to-supply ratios
        //This will make them favor entering an underserved market over
        //Just picking the most profitable cl/ass

        var bestOpportunity = this.getBestMarketOpportunity();
        if (bestOpportunity !== "") {
            var bestOpportunityRole = this.getRoleThatMakesMostOf(bestOpportunity);
            if (bestOpportunityRole !== "") {
                bestRole = bestOpportunityRole;
            }
        }

        var newAgent = new Agent(this.roles[bestRole], this);
        this.agents.pop(agent);
        newAgent.id = agent.id;
        console.log(
            "Agent " +
            agent.id +
            " (a " +
            agent.role.id +
            ") went bankrupt. He was replaced by a " +
            bestRole
        ); //bankrupt
        this.agents.push(newAgent);
    }
    transferCommodity(commodity, amount, sellerId, buyerId) {
        var seller = this.getAgent(sellerId),
            buyer = this.getAgent(buyerId);

        seller.inventory.stuff[commodity].amount -= amount;
        buyer.inventory.stuff[commodity].amount += amount;
    }
    transferMoney(amount, sellerId, buyerId) {
        var seller = this.getAgent(sellerId),
            buyer = this.getAgent(buyerId);

        seller.cash += amount;
        buyer.cash -= amount;
    }
    tick(times = 1) {
        console.log("ticking", times, "time(s)")
        for (var i = 0, l = times; i < l; ++i) {
            console.log('hello')


            this.agents.forEach((agent) => {
                var inventory = agent.inventory.list();
                agent._cash = agent.cash;

                agent.role.logic.perform(agent, agent.role.logic.root);

                inventory.forEach((commodity) => {
                    agent.generateOffers(this, commodity);
                }, this);
            }, this);

            this.commodities.forEach((commodity) => {
                this.resolveOffers(commodity.name);
            }, this);

            this.agents.forEach((agent) => {
                if (agent.cash <= 0) {
                    this.replaceAgent(agent);
                }
            }, this);
        }
    }
    test(commodity) {
        this.getAgent(1).inventory.stuff[commodity].amount = 5;
        this.getAgent(1).generateOffers(this, commodity);
        this.getAgent(2).generateOffers(this, commodity);
        this.resolveOffers(commodity);
    }

}



// var ecoMarket = new Economia(settings);








function getCommodityData(market) {
    var arr = [];
    ecoMarket.commodities.forEach((commodity) => {
        var avg = market.getAvgPrice(commodity.name);
        var current = market.history.price[commodity.name][market.history.price[commodity.name].length - 1]
        var last = market.history.price[commodity.name][market.history.price[commodity.name].length - 2];
        var diff = current - last;
        var c = {
            name: commodity.name,
            priceAvg: avg,
            diff: diff
        };
        arr.push(c);
    })
    return arr;
}




module.exports = { Economia: Economia, defaultSettings: settings };
