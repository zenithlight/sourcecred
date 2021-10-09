// @flow
import React, {useState, useEffect, type Node as ReactNode} from "react";
import {useLedger} from "../utils/LedgerContext";
import {type IdentityId, type Identity} from "../../core/identity";

import {TextField} from "@material-ui/core";
import {Autocomplete} from "@material-ui/lab";

type Props = {|
  +selectedId: IdentityId,
|};

export function IdentityMerger({selectedId}: Props): ReactNode {
  const {ledger, updateLedger} = useLedger();
  const [inputValue, setInputValue] = useState("");

  const potentialIdentities = ledger
    .accounts()
    .map((a) => a.identity)
    .filter((i) => i.id !== selectedId);

  const identitiesMatchingSearch = (input: string): Identity[] =>
    potentialIdentities.filter(({name}) =>
      name.toLowerCase().includes(input.toLowerCase())
    );

  const [inputItems, setInputItems] = useState(identitiesMatchingSearch(""));

  const setSearch = (input: string = "") =>
    setInputItems(identitiesMatchingSearch(input));

  useEffect(() => setSearch(), [selectedId]);

  return (
    <>
      <Autocomplete
        onInputChange={(_, value, reason) => {
          if (reason === "input") {
            setSearch(value);
            setInputValue(value);
          }
        }}
        onChange={(_, selectedItem, reason) => {
          if (reason === "select-option") {
            updateLedger(
              ledger.mergeIdentities({
                base: selectedId,
                target: selectedItem.id,
              })
            );
            setSearch("");
            setInputValue("");
          }
        }}
        freeSolo
        disableClearable
        options={inputItems}
        getOptionLabel={({name}) => name || ""}
        inputValue={inputValue}
        renderInput={(params) => (
          <TextField {...params} variant="outlined" label="Add Alias" />
        )}
      />
    </>
  );
}
