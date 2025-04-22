import { Blockfrost, Lucid, Crypto, Addresses, fromText, Data } from "https://deno.land/x/lucid/mod.ts";

const lucid = new Lucid({
    provider: new Blockfrost(
        "https://cardano-preview.blockfrost.io/api/v0",
        "previewSknEHRKNvW8fYKlgO2onJyUl0AbCFNhc",
    ),
});

const seed = "crisp jewel burst detail venue civil wine dynamic message quote sign text camp scheme cruel elite kid liar journey ridge behind brain master gospel"
lucid.selectWalletFromSeed(seed, { addressType: "Base", index: 0 });

const alwaysSucceed_scripts = lucid.newScript({
    type: "PlutusV3",
    script: "58af01010029800aba2aba1aab9faab9eaab9dab9a48888896600264653001300700198039804000cc01c0092225980099b8748008c01cdd500144c8cc896600266e1d2000300a375400d13232598009808001456600266e1d2000300c375400713371e6eb8c03cc034dd5180798069baa003375c601e601a6ea80222c805a2c8070dd7180700098059baa0068b2012300b001300b300c0013008375400516401830070013003375400f149a26cac80081",
});
const alwaysSucceedAddress = alwaysSucceed_scripts.toAddress();

const DatumSchema = Data.Object({
    msg: Data.Bytes,
});

const RedeemerSchema = Data.Object({
    msg: Data.Bytes, // msg là một ByteArray
});

const Datum = () => Data.to({ msg: fromText("Nguyen Quang Minh_391") }, DatumSchema);
const Redeemer = () => Data.to({ msg: fromText("Nguyen Quang Minh_391") }, RedeemerSchema);

async function getWalletInfor() {
    const address = await lucid.wallet.address();
    const utxos = await lucid.wallet.getUtxos();

    let totalLovelace = 0n;

    for (const utxo of utxos) {
        for (const [unit, quantity] of Object.entries(utxo.assets)) {
            if (unit === 'lovelace') {
                totalLovelace += BigInt(quantity);
            }
        }
    }

    const totalAda = Number(totalLovelace) / 1_000_000;

    console.log(`Địa chỉ ví: ${address}`);
    console.log(`Tổng ADA trong ví: ${totalAda} ADA`);
}

async function mintToken(tokenName: string, amount: bigint){
    //Create Minting Policy
    const { payment } = Addresses.inspect(
        await lucid.wallet.address(),
    );
    const mintingPolicy = lucid.newScript(
        {
            type: "All",
            scripts: [
                { type: "Sig", keyHash: payment.hash },
                {
                    type: "Before",
                    slot: lucid.utils.unixTimeToSlots(Date.now() + 1000000),
                },
            ],
        },
    );

    const policyId = mintingPolicy.toHash();

    const unit = policyId + fromText(tokenName);

    const tx = await lucid.newTx()
        .mint({ [unit]: amount })
        .validTo(Date.now() + 200000)
        .attachScript(mintingPolicy)
        .commit();

    const signedTx = await tx.sign().commit();

    const txHash = await signedTx.submit();

    const assetId = policyId + fromText(tokenName);
    console.log(`TxHash Mint Token: ${txHash}`);
    console.log(`Asset ID: ${assetId}`);
}

export async function lockUtxo(lovelace: bigint, assetId: string): Promise<string> {
    const tx = await lucid
        .newTx()
        .payToContract(alwaysSucceedAddress, { Inline: Datum() }, { lovelace, [assetId]: 500n })
        .commit();

    const signedTx = await tx.sign().commit();

    const txHash = await signedTx.submit();
    
    console.log(`TxHash Lock Utxos: ${txHash}`);

}

export async function unlockUtxo(redeemer: RedeemerSchema): Promise<string> {
    const utxo = (await lucid.utxosAt(alwaysSucceedAddress)).find((utxo) => 
        !utxo.scriptRef && utxo.datum === redeemer // && utxo.assets.lovelace == lovelace
    );

    if (!utxo) throw new Error("No UTxO with found");

    const tx = await lucid
        .newTx()
        .collectFrom([utxo], Redeemer())
        .attachScript(alwaysSucceed_scripts)
        .commit();
    
    const signedTx = await tx.sign().commit();
    
    const txHash = await signedTx.submit();
    
    console.log(`TxHash Unlock Utxos: ${txHash}`);
}


async function main() {
    getWalletInfor();
    //mintToken("BK03_391", 500n)
    //lockUtxo(50_000_000n, "f40622a428a7c269adc195c30baf78291d0be178213be8725588162d424b30335f333931");
    unlockUtxo(Redeemer());
}

main();