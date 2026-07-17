2026-07-17T18:20:00Z item=SUMMARY#1 type=code action=fix commit=a1e2ec8af08ed543b403214bcf5aba89b6494f80
2026-07-17T18:24:00Z item=SUMMARY#1 type=code action=mutation-verify severity_downgrade result=detected(7_fail) reverted=true
2026-07-17T18:24:16Z item=preexisting-mutation type=code action=mutation-verify override_off result=detected(15_fail) reverted=true
2026-07-17T18:24:16Z item=preexisting-mutation type=code action=mutation-verify bare_entry_removed result=detected(2_fail) reverted=true
2026-07-17T18:24:35Z item=preexisting-mutation type=code action=mutation-verify nevermatch_regex result=detected(8_fail) reverted=true
2026-07-17T18:27:36Z lint status=pass warnings=12
2026-07-17T18:27:36Z unit status=pass note=first_run_backend_sigsegv_flake_unrelated rerun=pass(412/412)
2026-07-17T18:29:39Z e2e attempt=1 status=pass duration=372s tests=256 playwright=confirmed
