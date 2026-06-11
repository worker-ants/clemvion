# RESOLUTION — production fail-closed 가드 최종 재리뷰 (04 C-1·M-4·M-7)

리뷰 세션: `review/code/2026/06/11/10_52_27/` (rebase 후 최종 재리뷰). 위험도 **LOW** · Critical 0 · Warning 3 · INFO 15.

> 핵심 개선(JWT_SECRET 최소길이 CWE-521, dead fallback 제거, isFlagOn 재사용, ENCRYPTION_KEY 예시 키
> 차단, MCP throw)은 선행 커밋에서 이미 반영됐다. 본 세션 잔여 Warning 3건은 전부 LOW("권장/선택")이며,
> W1 은 spec 설계와의 관계상 수용이 정합적이라 **코드 추가 변경 없이** 근거와 함께 수용한다.

## 수용 — Warning (근거)

| # | 카테고리 | 판단 | 근거 |
| --- | --- | --- | --- |
| W1 | 보안/입력검증 | **수용 (M-4 범위 충족, 형식강화는 후속)** | `ENCRYPTION_KEY` 의 길이/형식 미검증은 **의도된 spec 설계**다 — `secret-store.md §3.3` 이 "정확 64-char hex → 그대로, **그 외 임의 길이 문자열 → SHA-256 derive**" 를 명시한다(짧은 키·비-hex 도 SHA-256 으로 파생). M-4 의 요구는 "공개 `.env.example` 예시 키 + 미설정의 production 차단" 이고 이는 충족했다. production 전용 최소 엔트로피 강제(예: 64-hex only)는 spec §3.3 의 "임의 길이 허용" 을 production 에서 좁히는 **별도 정책 결정**이라 planner 선행이 필요 — 후속 항목으로 분리한다. (JWT_SECRET 은 §3.3 같은 "임의 길이 허용" 서술이 없어 최소길이 강제가 spec 비저촉이라 적용했다 — 둘의 spec 전제가 달라 대칭 부재는 의도적.) |
| W2 | 보안/인증 | **수용 (설계상 허용)** | `INTERACTION_JWT_SECRET` 미설정 시 `JWT_SECRET` fallback 은 EIA `14-external-interaction-api.md §8.3` 이 명시한 fallback chain(설계)이다. production 에서 둘 다 미설정이면 `InteractionTokenService` 생성자가 throw(fail-closed). WARNING 로그 추가는 blocking 아닌 선택 — 별 항목. |
| W3 | 문서화 | **수용 (추적 가능)** | `production-guards.ts` 주석은 `interaction-token.service.ts` 로 코드 추적 가능하고, EIA §8.3 spec 링크는 `1-auth.md ## Rationale "Production fail-closed 가드"` 가 이미 제공한다. 코드 주석에 spec 경로 병기는 선택 — 현 상태 수용. |

## 수용 — INFO

대부분 "없음"(설계 적절) 또는 정합 확인. 잔여 선택 항목: I6(`parseMasterKey` SHA-256 derive dev/e2e 전용 주석 강화), I8(`NotFoundException` ref 노출 상위 필터 확인), I14(`INTEGRATION_ENCRYPTION_KEY` .env 안내) — 전부 본 PR scope 밖(기존 코드/별 영역) 또는 LOW 선택. RESOLUTION 으로 추적.

## TEST 결과

- **lint**: 통과
- **unit**: 통과 (backend 6532 — PR B rebase 포함 + production-guards 23건)
- **build**: 통과 (`nest build`)
- **e2e**: 통과 (dockerized, 188 — rebase 상태 PR B+PR C 통합; 가드는 NODE_ENV=test 라 미발동·정상 부팅)

## 보류·후속 항목

- **ENCRYPTION_KEY production 형식/최소엔트로피 강제**(W1) — spec `secret-store.md §3.3` 의 "임의 길이 허용" 을 production 에서 좁히는 정책 결정 동반 필요(planner). 별 항목.
- `INTERACTION_JWT_SECRET` 분리 강제 + 미설정 WARNING(W2) — 선택.
