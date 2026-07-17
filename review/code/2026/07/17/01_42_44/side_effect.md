Confirmed this is already committed as `436ee334e`, not modified since. No CHANGELOG.md entry exists for this change. Now compiling the final review.

## 발견사항

- **[INFO]** `webauthn-response.dto.ts` — 오래된 주석 정정 사례 (모범)
  - 위치: `codebase/backend/src/modules/auth/webauthn/dto/responses/webauthn-response.dto.ts:74` `WebAuthnCredentialListDto`
  - 상세: 기존 주석 "`SessionListDto` 의 이중 중첩 패턴은 피한다"가 실재하지 않는 구분을 주장하던 것을 발견해, 실제 계약(`{items:[]}` shape 이 `SessionListDto` 와 **동일**하고 인터셉터를 거쳐 `{data:{items:[]}}`로 나가는 load-bearing 계약)과 spec cross-ref(`5-system/2-api-convention.md §5.2`, `5-system/1-auth.md`)로 교체했다. 두 spec 참조 모두 실존 섹션(§5.2 "목록 응답" 확인됨)을 가리켜 정확하다. 주석-코드 drift를 근본적으로 바로잡은 좋은 사례.
  - 제안: 없음 (조치 불필요, 참고용 긍정 사례).

- **[INFO]** `use-widget.ts` — TDZ ref workaround에 대한 문서화 품질 우수
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1142-1145`, `:1167-1170`, `:1354-1360`, `:1397-1415`
  - 상세: `seedWaitingFromStatusRef`를 통한 순환 참조 회피, `execution.replay_unavailable` 분기의 spec 근거(EIA §5.2·NF-03, widget-app §3.1), `seedWaitingFromStatus`의 JSDoc(`@param`/호출 시점/실패 정책/파싱 재사용/의존성 배열 근거)이 모두 "왜"를 설명하는 인라인 주석·JSDoc으로 충실히 남아있다. 렌더 중(이펙트 밖) ref 대입이 안전한 이유("deps `[]`로 stable하므로 최초 1회 대입으로 충분")까지 명시해 향후 유지보수자가 오해할 여지를 줄였다.
  - 제안: 없음.

- **[INFO]** `use-widget-eager-start.test.ts` — 신규 헬퍼·신규 테스트 문서화 우수
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:507-530` (`installControllableEventSource` JSDoc), `:354-359` (신규 `describe` 블록 상단 주석)
  - 상세: 신규 헬퍼가 기존 `installControllableSse`와의 관계·사용 시점을 `@returns` 포함 JSDoc으로 명확히 구분했고, 신규 회귀 테스트 앞에는 spec 링크(`7-channel-web-chat/1-widget-app.md §3.1`)와 배선 배경(2026-07-17)을 남겨 향후 이 테스트가 왜 존재하는지 추적 가능하다.
  - 제안: 없음.

- **[WARNING]** CHANGELOG.md 미갱신 — 위젯 동작 변화(behavior change) 누락
  - 위치: `CHANGELOG.md` (루트), 관련 변경: `codebase/channel-web-chat/src/widget/use-widget.ts`의 `execution.replay_unavailable` 소비 배선
  - 상세: 본 저장소 `CHANGELOG.md`는 `## Unreleased — <제목>` 섹션으로 env var 추가·behavior change·에러코드 신설 등 사용자-관측 가능한 변경을 꾸준히 기록해 온 컨벤션이 있다(직전 다수 커밋 참고: LLM timeout, tool-payload-budget 등). 이번 변경은 위젯이 SSE 버퍼(5분) 만료 시 그동안 **로컬 시간 기준(>5분) 판단**으로 폴백하던 것을 **서버 이벤트(`execution.replay_unavailable`) 기반 즉시 재동기화**로 바꾼 실질적 동작 변화(사용자가 체감하는 재동기화 타이밍·정확도 개선)이지만 `CHANGELOG.md`에 해당 Unreleased 섹션이 없다.
  - 제안: 관례에 맞춰 `## Unreleased — web-chat 위젯 버퍼 만료(EIA-NF-03) 이벤트 기반 재동기화` 같은 섹션을 추가하고, 서버 emit은 기 구현됐고 이번 PR로 클라이언트 소비 분기가 완성됐다는 점, SoT(`spec/7-channel-web-chat/1-widget-app.md §3.1`)를 명시할 것을 권장. (BLOCK 사유는 아님 — plan 파일(`spec-sync-external-interaction-api-gaps.md`)에 상세 이력이 이미 남아 추적 가능하므로 CHANGELOG 누락은 관례 일관성 차원의 WARNING.)

- **[INFO]** plan/spec 동기화 — SDD 원칙 준수 모범 사례
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `plan/in-progress/eia-context-schema-followups.md`, `plan/in-progress/exec-intake-followups.md`, `spec/7-channel-web-chat/1-widget-app.md:101-107`
  - 상세: 코드 변경(위젯 소비 배선, EventSource stub 통합, webauthn 주석)마다 대응하는 plan 항목을 `[x]` 완료 처리하고 spec 본문(`1-widget-app.md §3.1`)의 "서버 emit이 구현됐고… 소비 분기는 아직 미배선(no-op)"이라는 stale 서술을 구현 상태에 맞춰 갱신했다. 이는 CLAUDE.md가 규정한 "정보 저장 위치 단일 진실 원칙"(spec 본문 = SoT)을 정확히 지킨 사례다.
  - 제안: 없음.

- **[INFO]** README — 해당 없음
  - 상세: 이번 변경은 신규 공개 기능·설정이 아니라 이미 spec에 약속된 동작(§3.1)을 배선한 것이고, 신규 env var·API 엔드포인트도 없어 README 갱신 필요성은 없다.

### 요약
전반적으로 문서화 품질이 매우 높은 변경 세트다. `webauthn-response.dto.ts`의 오래된(부정확한) JSDoc을 실제 계약에 맞게 정정했고, `use-widget.ts`의 TDZ ref 우회·`replay_unavailable` 소비 로직에는 "왜"를 설명하는 상세한 인라인 주석과 spec cross-ref가 충실히 달려 있으며, plan 파일과 spec 본문(`1-widget-app.md §3.1`)까지 구현 상태에 맞춰 동기화되어 SDD 원칙을 모범적으로 따르고 있다. 유일한 아쉬운 점은 위젯의 버퍼 만료 재동기화 방식이 로컬 시간 기준에서 이벤트 기반으로 바뀐 실질적 behavior change임에도 `CHANGELOG.md`에 반영되지 않은 점으로, 저장소의 기존 CHANGELOG 관례(거의 모든 Unreleased 동작 변화를 기록)와 일관성이 떨어진다.

### 위험도
LOW