# 신규 식별자 충돌 검토 — `spec/7-channel-web-chat` (델타: R0 → R7 재번호 + `2-sdk.md` 상호참조 1줄)

## 점검 대상 (이번 델타)
- `spec/7-channel-web-chat/4-security.md`: `### R0. ...`(R1~R6 앞 삽입, 직전 라운드에서 NONE 판정) →
  `### R7. ...`(R1~R6 뒤로 이동 + 재번호, 2026-08-11)
- `spec/7-channel-web-chat/2-sdk.md`: `BootConfig.apiBase` 필드 주석에 `[4-security §1 apiBase 입력 검증 · §R7](./4-security.md)` 1줄 추가

## 확인 절차
- `git diff origin/main -- spec/7-channel-web-chat/4-security.md` / `2-sdk.md` 로 이번 델타의 실제 변경 범위를 diff 기준으로 한정.
- `4-security.md`·`3-auth-session.md`·`1-widget-app.md`·`5-admin-console.md` 전체에 대해 `^### R` 헤딩을 전수 나열해 파일별 R-번호 유일성 확인.
- 저장소 전체(`spec/`, `codebase/`, `plan/`, `review/`)에서 `§R0`/`#r0`/`### R0.` 잔존 참조를 grep.
- `4-security.md#r` 앵커 프래그먼트를 인용하는 타 문서를 전수 grep.

## 발견사항

- **[WARNING] 코드 주석의 "spec §R0" 참조가 죽은 앵커 — 현재 spec 번호는 §R7**
  - target 신규 식별자: `spec/7-channel-web-chat/4-security.md`의 `### R7. ...`(이번 델타로 `R0`에서 재번호)
  - 기존 사용처: `codebase/channel-web-chat/src/widget/use-widget.ts:197`(`safeApiBase` JSDoc 내부, 이전 라운드 `ai-review 15_32_44` CRITICAL 처분 커밋 `99d3e9000`에서 추가된 역사적 각주)
    ```
    > 첫 판은 "`applyConfig` 가 자기 자리에서 실패한다" 고 적었다. **거짓이다.** spec §R0 에서
    > 그 문장을 정정하면서 **여기(코드 SoT)는 안 고쳤다** — 한 사실을 두 곳에 복제해 놓고 한
    > 곳만 고친 형태다(ai-review `15_32_44` documentation CRITICAL).
    ```
  - 상세: 이 각주가 추가된 시점(직전 라운드 `15_32_46`)에는 해당 spec 섹션이 실제로 `### R0.`였으므로 참조가 정확했다(그 라운드의 naming_collision 판정도 NONE — 근거: `review/consistency/2026/08/11/15_32_46/naming_collision.md`). 그런데 **이번 델타**가 그 섹션을 명명 관례 위반(R1~R6 앞 삽입은 이 저장소에서 유일 사례) 사유로 `R7`로 재번호하고 문서 끝(R6 뒤)으로 옮기면서, `4-security.md` 자체와 `2-sdk.md`의 신규 상호참조는 `§R7`로 갱신됐지만 **`use-widget.ts`의 이 코드 주석은 갱신되지 않고 `§R0` 문구가 그대로 남았다**. 저장소 전체 grep(`git grep -n "§R0\|#r0\b"`) 결과 이 1곳이 유일한 잔존 참조다. 반면 같은 사실을 서술하는 `plan/complete/webchat-boot-apibase-scheme-validation.md:93`은 `"§R7(당시 §R0)"`처럼 신·구 번호를 함께 표기해 정합을 유지했다 — 즉 plan 쪽은 갱신됐고 code 쪽만 놓쳤다. 이는 이 저장소가 이미 여러 차례(`ai-review 15_32_44` CRITICAL 포함) 지적해 온 "한 사실이 여러 곳에 복제되고 한 곳만 고친다" 패턴의 재발이며, 지금 `use-widget.ts:197`을 읽는 개발자가 `4-security.md`에서 "R0"를 검색하면 아무것도 찾지 못해 혼선을 겪는다(§R0는 spec 상 더는 존재하지 않는 죽은 앵커).
  - 제안: `use-widget.ts:197`의 `spec §R0` 를 `spec §R7`(또는 plan 과 동일하게 `§R7(당시 §R0)`)로 갱신한다. `4-security.md`/`2-sdk.md`는 이미 정합 상태이므로 이 1곳만 맞추면 세 자리가 다시 일치한다.

- **[정보 확인] `R7` 앵커 유일성 — 파일별로 문제 없음**
  - `4-security.md`: `^### R` 헤딩 전수 나열 결과 `R1`~`R7` 각 1회, 중복 없음(`R7`은 이번 델타로 추가된 유일한 R7).
  - 같은 스코프 내 `3-auth-session.md`(R3~R8, 자체 R7 보유)·`1-widget-app.md`(R4~R10, 자체 R7 보유)·`5-admin-console.md`(R1~R7, 자체 R7 보유)에도 각자 독립된 `### R7.` 헤딩이 있으나, R-번호는 문서별 로컬 네임스페이스이고 저장소 관례상 모든 교차참조가 `"<파일명> §R7"` 형태로 파일명을 항상 동반한다(예: `2-sdk.md`가 `` `3-auth-session.md` §R7 `` 과 `[4-security §1 ... §R7](./4-security.md)`를 명확히 구분해 인용). 실사용 혼동 위험 없음.

- **[정보 확인] 기존 R1~R6 앵커를 인용하는 타 문서 — 안 깨짐**
  - `4-security.md#r6-공개-webhook-ip-미식별--단일-공유-버킷-완화-한도`를 인용하는 문서: `spec/5-system/1-auth.md:713`, `spec/5-system/12-webhook.md:69,338,392`, `spec/data-flow/10-triggers.md:101`(총 5개소, 3개 파일).
  - 상세: 이번 델타는 `R7`을 **신설**(R0의 재배치)했을 뿐 `R1`~`R6`의 헤딩 텍스트를 변경하지 않았다(전수 확인). GitHub 스타일 앵커는 헤딩 텍스트 슬러그이므로 `#r6-...` 프래그먼트도 그대로 유지되며, 위 5개소 참조는 모두 유효하다.
  - 제안: 없음(조치 불요).

- **[정보 확인] 신규 식별자(`R7` 자체 외) — 추가 충돌 없음**
  - 이번 델타는 spec 본문(`4-security.md` 신규 Rationale 절 재배치, `2-sdk.md` 1줄 주석)만 건드리며 신규 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일경로를 도입하지 않는다(함수명 `safeApiBase`/`mergeBootConfig`는 직전 라운드에서 이미 검토·NONE 확정, 이번 델타의 diff 범위 밖).

## 요약
이번 델타(R0→R7 재번호 + `2-sdk.md` §R7 상호참조 1줄)는 spec 문서 내부적으로는 정합하다 — `4-security.md`의 `R7`은 그 문서 안에서 유일하고, 재배치가 기존 `R1`~`R6` 헤딩 텍스트를 바꾸지 않아 3개 타 spec 문서·5개소의 `#r6-...` 역참조도 깨지지 않았다. 다만 재번호가 spec 파일 밖(`codebase/channel-web-chat/src/widget/use-widget.ts:197`)의 코드 주석까지는 전파되지 않아, 직전 라운드까지는 정확했던 `spec §R0` 인용이 이번 델타로 인해 **죽은 앵커**가 됐다 — 같은 사실을 서술한 `plan/complete/webchat-boot-apibase-scheme-validation.md`는 신·구 번호를 함께 표기해 정합을 지켰으나 코드 쪽은 놓쳤다. 기능적 영향은 없고(주석 텍스트일 뿐 동작에 무관) spec 구조 자체의 충돌도 아니므로 WARNING 1건으로 판정한다.

## 위험도
LOW

STATUS: OK
