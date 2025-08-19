# List transaction for test

- Mainnet
  InitializeConfig = 5Kna4KKq7KK465mbTaQrngr3zvaXEohzt8edDbyfKTvfSDDgdfPv7pSYofRfp1FvXrVDMpLziwFqKJgaGpB9yyLL
  InitializeBinStepConfig = 4kTqfwmeVAgpSByFCrZGXt6CxezsE4dPS6SBqM3s7o4jn2RSA1K8ejnKgv537Wy1GJ3jDFsKzWFTw4z8HBk8RTkK
  InitializeQuoteAssetBadge = 3fMXMP7fcCG23vLeNCPZrRVNA6nM7GKbC15TGYis5wPPLcwCcUGrbYFZhPfERgw9XuwoJWgjG5gmdng5DxHTTZvR
  InitializePair = 22xADbyM1btYSV8qMDr2LKT9MvGmiRtTjunrc5x5fc45AspajtsL6DwZr2dLvAsdhYNo9PhZRRp9vnnw6ntUrJCo
  InitializeBinArray = 22xADbyM1btYSV8qMDr2LKT9MvGmiRtTjunrc5x5fc45AspajtsL6DwZr2dLvAsdhYNo9PhZRRp9vnnw6ntUrJCo
  InitializeBinArray2 = 5oFb18Cq7QEmY35A6k3aQkZbBeAgpPrYKXFwv6FPwiMKndzkZU5B1wWAi5Y353w6DW2hTcUey1ADyHfTJdQ4zxL3
  CreatePosition = 4MCJaK8w4F2wEXGMXtvbWQR3nHBqunt2DKFKQZaA6oeCzncPGP8r9MrobjpuwLxVL8zrWYegoeenqQP3uBhrFWhc
  IncreasePosition = 3Egib77doiVUkdbAnMyx5HoeE7RkoM16NvDvUMqKURtfeSM9cwTAvMtnfgcAAjuQ2RnaFNN5Kx4JKtgfdUonxmgZ
  DecreasePosition = 3ydUQGsimZPtzyP3iMsxGhLp3gSmGTUjRq7S9a3SL6PxFfKGgj2UdJVUD7snruqao25LPHPs6zv1FYjdEeiEtrcF
  ClosePosition = TJZ9eo7SERGBTk7dR7bhucCDQ6TD3mUNz6eCZt9S3fcYrBeTbWiRcyMysq9Xhs78qWJfvmT4FCSzfZt2NygtsSu
  Swap = 2m4n9jpX4EYK4rE3rkRXb7tr9LWabFPqyvueFn4nrKu1HDfmCRrzpUi4Lwkj3BF1smbdRXFP39kqewTbaci2zbo1
  Swap = 4Q7bTe6wjdmHS4a3dVzYAQ8YNdX3iUsCpR6rx7ia5WAkNEaeddiLHaVsspfnEYQXkJFJbk5wTDxdqbCZkQgGZi4A

  SAROS-USDC
  InitializeBinStepConfig = 2YoKYjLChSs5jMzZkDXJvgfaAKvdaABBHPW2AnpJVPbdgMTE8RxzB3ompoXUh16hR5iafzutwE8uyB4c97MLWQPP
  InitializePair = Y2QvSt2md1XVpFSW1ucodS7FFdUU3nEKUeDFBqrgTHJzPHdoVWZ3ACMVWnkWNZFVmfR7mvn9rDsgLwXF4kpaGhe
  CompositionFeeEvent = 54LML8qXjJXq4JRbTiGgyJ76NVURWGhZGA9Xnjgo2ucdDtNfY98rXeUPDCyfpjW7FXpv8nAR9XkirTCKjhkxG5ba // saros - usdc

- Devnet

# List processor

| Processor                         | Status | Handler                |
| --------------------------------- | ------ | ---------------------- |
| initialize_bin_step_config        | done   | instruction            |
| initialize_pair                   | done   | instruction            |
| quote_asset                       | done   | event                  |
| initialize_bin_array              | done   | instruction            |
| create_position                   | done   | instruction + event    |
| close_position                    | done   | instruction (not test) |
| increase_position                 | done   | event (not test)       |
| decrease_position                 | done   | event (not test)       |
| composition_fees                  | done   | event                  |
| dlq                               |        |                        |
| swap                              | done   | instruction + event    |
| update_bin_step_config            |        |                        |
| update_pair_static_fee_parameters | done   | instruction (not test) |

