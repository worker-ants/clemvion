# Resolution — npm audit 의존성 업그레이드 리뷰 후속

리뷰 위험도: **LOW** · Critical 0 · Warning 2 · 처리 주체: main (bg-worktree 에서 sub-agent write 차단되어 수동 처리)

## WARNING #1 — `nodemailer` deps + overrides 중복 선언

**판정: RESOLVED (문서화 — override 는 의도된 필수 항목, 제거 불가)**

- 검증 결과 `dependencies` 내부의 **literal 중복(JSON 키 중복)은 없음**. `nodemailer` 는 `dependencies` 1회(`^9.0.1`, line 69) + `overrides` 1회(`^9.0.1`, line 139)로, deps+overrides 패턴이다.
- override 는 **반드시 필요**하다: direct `nodemailer` 는 9.0.1 로 올렸으나 `@nestjs-modules/mailer` 의 optional 의존 `preview-email` → `mailparser` 가 `nodemailer@8`(취약, GHSA `<=9.0.0` raw 옵션 파일읽기/SSRF)을 **중첩 설치**한다. override 로 두 중첩 사본까지 9.0.1 로 강제해야 high 가 사라진다. override 를 제거하면 해당 high 가 재발한다 (해당 preview 기능은 앱에서 미사용 — grep 확인).
- 제안된 "deps 말미 항목 제거" 는 적용 불가(잘못된 진단). 대신 **`"//security-overrides"` 주석을 backend `package.json` 에 추가**해 deps+overrides 가 의도된 중첩-사본 강제임을 명시했다.
- 부수적으로 INFO #9(frontend overrides 주석)·#10(backend overrides 주석)·#11(nodemailer override 사유) 도 본 주석으로 함께 해소. frontend `package.json` overrides 에도 동일 패턴 주석 추가.

## WARNING #2 — `@opentelemetry/propagator-aws-xray` peer 상한 `@opentelemetry/api <1.10.0`

**판정: ACKNOWLEDGED — 무조치 (현재 충돌 없음, 범위 외)**

- 현재 `@opentelemetry/api` 는 `^1.9.x` 로 peer 범위(`>=1.0.0 <1.10.0`) **내**다 → 현재 peer 불일치 없음.
- `propagator-aws-xray` 는 `@opentelemetry/auto-instrumentations-node`(0.76→0.77 bump 대상)가 번들하는 **기존 전이 의존성**으로, 본 PR 이 신규 도입한 것이 아니다.
- `@opentelemetry/instrumentation-aws-lambda` 비활성화는 **런타임 동작 변경**이라 보안 audit 전용 PR 의 범위를 벗어난다. 현재 버전 충돌이 없으므로 본 PR 에서 강제 조치 불필요.
- **forward-looking 주의로 기록**: 추후 `@opentelemetry/api` 를 `>=1.10.0` 으로 올릴 때 본 peer 상한을 재확인하고, AWS Lambda 미사용이 확정되면 그 시점에 instrumentation 제외를 검토한다.

## INFO 항목 처리

- INFO #1/#2/#3/#6(보안 업그레이드 방향 긍정) — 확인, 조치 불필요.
- INFO #4/#5/#8(otel host-metrics / X-Ray 헤더 / systeminformation 번들) — auto-instrumentations 전이 의존성의 기존 동작. 민감정보 필터링·instrumentation 제외는 별도 운영 설정 사안으로 본 PR 범위 외. 기록만.
- INFO #7(dompurify 핀 방식: webchat exact `3.4.11` vs frontend range `^3.4.11`) — 각 워크스페이스의 기존 핀 규약을 존중(webchat `//pin` 은 공급망 무결성으로 exact, frontend 는 caret 관행). 통일은 별도 결정 사안으로 보류.

## 재검증

- package.json 2건 valid JSON 확인. 주석은 npm 무시 키(`"//..."`)라 lockfile/빌드/audit 에 영향 없음.
- audit 재실행: backend 0 high·0 crit (잔여 19 moderate js-yaml + 1 low @babel — accepted) / frontend 0 high·0 crit (js-yaml moderate) / webchat 0 high·0 crit (js-yaml moderate). 변동 없음.
- 핵심 버전 가드: swagger 11.2.7(회귀 없음)·nodemailer 9.0.1·otel sdk-node 0.219.0/core 2.8.0·ws 8.21.0·multer 2.2.0 유지. lockfile↔node_modules 동기 확인.
- build/unit/e2e 는 comment-only 변경이라 결과 불변(직전 통과: build 3/3 · backend unit 7128 · frontend 4486 · webchat 191 · e2e 205 PASS@node24).
