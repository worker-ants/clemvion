# 정식 규약 준수 검토 — `spec/7-channel-web-chat` (R0→R7 재번호 처분 검증)

대상 커밋: `99d3e9000`(`fix(webchat): 정정을 한 곳에만 했다 + 내 새 테스트가 vacuous 했다`) — 직전 라운드(`review/consistency/2026/08/11/15_32_46/convention_compliance.md`)가 낸 convention WARNING(`R0` 이 저장소 전역 관례 위반)의 처분(R0→R7 재번호 + 문서 끝 append)을 검증한다.

## 확인 결과 (지시받은 4개 항목)

### 1. 재번호 완결 — `### R0.` 잔존 0, R1~R7 단조 순서

**완결됨.** `spec/7-channel-web-chat/4-security.md` 의 `## Rationale` 절은 현재:

```
177: ### R1. CORS 두 공개 표면 분리 (...)
184: ### R2. 임베드 검증 soft 기본 / hard `frame-ancestors` opt-in
202: ### R3. 남용 방어 rate-limit — fixed-window + fail-open
219: ### R4. 마크다운 sanitize — deny-by-default allowlist (blacklist 기각)
225: ### R5. iframe sandbox `allow-same-origin` — 완전 격리 원칙의 한정 적용
244: ### R6. 공개 webhook IP 미식별 — 단일 공유 버킷 완화 한도
272: ### R7. `apiBase` 스킴 검증을 **두 경로 모두**에 거는 이유 (2026-08-11)
```

R1→R7 단조, 중복·결번 없음. `spec/` 전체에서 `### R0.` 헤딩 잔존 0건(`grep -rn "^### R0\." spec/` 빈 결과). `R7` 항목이 문서 끝(`## Rationale` 절의 마지막 섹션)에 위치해 "R1 시작·끝에 append" 관례를 만족한다.

### 2. 기존 R1~R6 앵커 보존 — 타 문서 인용 전수 확인

**깨지지 않음.** 저장소 전체에서 `4-security.md` 의 R-앵커를 인용하는 곳은 R6 뿐이며(4곳), 전부 유효하다:

- `spec/5-system/1-auth.md:713`
- `spec/5-system/12-webhook.md:69, 338, 392`
- `spec/data-flow/10-triggers.md:101`

전부 `[4-security R6](.../4-security.md#r6-공개-webhook-ip-미식별--단일-공유-버킷-완화-한도)` 형태이고, R6 헤딩 텍스트(`### R6. 공개 webhook IP 미식별 — 단일 공유 버킷 완화 한도`)가 재번호 전후로 불변이므로 GitHub 스타일 앵커 슬러그도 그대로 유효하다. R1~R5 앵커를 참조하는 타 문서는 존재하지 않는다(R7 삽입이 R1~R6 을 shift 하지 않았으므로 애초에 깨질 여지가 없었음 — 새 항목을 R0 자리가 아니라 끝에 붙였기 때문).

### 3. `§R0` 를 가리키던 참조 갱신 여부 — **미완, WARNING**

- **[WARNING] `use-widget.ts` 의 새 JSDoc 코멘트가 이미 죽은 `§R0` 를 인용한다**
  - target 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:197`
    ```
    * > 첫 판은 "`applyConfig` 가 자기 자리에서 실패한다" 고 적었다. **거짓이다.** spec §R0 에서
    * > 그 문장을 정정하면서 **여기(코드 SoT)는 안 고쳤다** — 한 사실을 두 곳에 복제해 놓고 한
    * > 곳만 고친 형태다(ai-review `15_32_44` documentation CRITICAL).
    ```
  - 위반 관례: 이번 라운드가 검증 중인 처분 자체("R0 → R7 재번호, 저장소 전역 관례 정합") — 및 CLAUDE.md 의 단일 진실(SoT) 원칙(한 사실을 가리키는 복수 참조는 동기화돼야 함).
  - 상세: `git show 99d3e9000` 로 확인한 결과, **바로 이 인용 블록 자체가 R0→R7 재번호와 같은 커밋(`99d3e9000`)에서 신규 추가됐다.** 즉 이 커밋은 `4-security.md` 의 섹션을 `R0`→`R7` 로 재번호하면서, 동시에 새로 쓴 코드 주석 안에는 여전히 "spec §R0" 이라고 못박았다 — 재번호 전 이름을 그대로 물려받은 채 굳힌 것이다. 현재 `spec/7-channel-web-chat/4-security.md` 에는 `§R0` 가 존재하지 않으므로, 이 코드 주석을 따라가는 독자는 존재하지 않는 섹션을 찾게 된다. 공교롭게도 이 정확한 실패 패턴("한 사실을 두 곳에 복제해 놓고 한 곳만 고침")을 이 주석 자신이 설명하고 있다 — 이번엔 그 패턴이 R-번호 자체에서 재발했다.
  - 비교: 같은 커밋에서 `plan/complete/webchat-boot-apibase-scheme-validation.md` 는 정확히 처리됐다 — `§R0` → `§R7(당시 §R0)` 로 갱신해 역사적 맥락과 현재 앵커를 모두 보존한다(라인 93). `use-widget.ts` 만 놓쳤다.
  - 제안: `spec §R0` → `spec §R7(당시 §R0)` 또는 단순히 `spec §R7` 로 갱신. `plan/complete/webchat-boot-apibase-scheme-validation.md:93` 이 이미 쓴 "§R7(당시 §R0)" 표기를 그대로 따르면 일관적이다.
  - `review/**` 하위(예: `review/code/2026/08/11/15_32_44/*`, `review/consistency/2026/08/11/15_32_46/*`)의 `§R0` 잔존은 완료된 라운드의 역사적 산출물이라 대상 아님(CLAUDE.md `review/` 산출물 규약 — 재발급하지 않는 스냅샷).

### 4. `2-sdk.md` 신규 상호참조 줄의 코드블록 주석 관례 정합성 — **경미한 불일치, WARNING**

- **[WARNING] 신규 `apiBase` 주석이 같은 코드블록 형제 줄과 다른 마크업 스타일을 쓴다**
  - target 위치: `spec/7-channel-web-chat/2-sdk.md:149` (```ts` 펜스 내부, `interface BootConfig` 첫 필드)
    ```ts
    apiBase: string;                  // API **origin**. 런타임 검증: http(s) 스킴만 허용 — 위반 시 그 필드만 무시(부팅은 계속). [4-security §1 `apiBase` 입력 검증 · §R7](./4-security.md)
    ```
  - 위반 관례: 명문화된 `spec/conventions/*.md` 항목은 없음(이 패턴은 문서별 관행). 근거는 같은 코드블록의 형제 줄들과 §1 스니펫 예시의 기존 스타일 일관성, 그리고 CommonMark 펜스드 코드블록의 렌더링 특성(펜스 내부는 마크다운이 파싱되지 않고 리터럴로 출력됨).
  - 상세: 같은 `interface BootConfig` 블록의 바로 아래 줄들은 상호참조를 **일반 산문**으로 적는다 — 예 `locale?: 'ko' | 'en'; // ... 아래 주·R6 참조`, `headerTitle?: string; // 봇 표시명(콘텐츠)`. §1 HTML 스니펫의 `apiBase`/`locale` 주석도 마찬가지로 `(런타임 주입, 0-architecture §4)`, `(§4·R6)` 형태의 산문이다. 반면 신규 줄은 `**origin**`(굵게) + `` `apiBase` ``(백틱) + `[...](...)` (마크다운 링크) 세 가지 마크업을 한 줄에 조합했는데, 이 줄이 속한 펜스(```ts` ~ ` ``` `)는 코드블록이라 마크다운 렌더러가 내부를 파싱하지 않는다 — 실제 렌더 결과는 클릭 가능한 링크가 아니라 `[4-security §1 `apiBase` 입력 검증 · §R7](./4-security.md)` 리터럴 텍스트다. `spec/7-channel-web-chat/*.md` 전체에서 `// ...[...](...)` 형태의 코드블록-내 마크다운 링크는 이 줄이 유일하다(`grep` 확인, 0건 vs 1건).
  - 참고: 저장소 전체로 보면 완전히 전례가 없는 것은 아니다 — `spec/5-system/14-external-interaction-api.md:468` 는 ```jsonc` 펜스 안 `//` 주석에 `[Conversation Thread §4.4.6 / §5.1](../conventions/conversation-thread.md)` 형태의 마크다운 링크를 쓴 선례가 있다(단, 그쪽은 링크만 쓰고 굵게+백틱을 겹치지 않음). 따라서 이 지적은 "저장소 전역 금지 패턴"이 아니라 **같은 문서·같은 코드블록 내부의 형제 줄과의 스타일 불일치**로 국한한다.
  - 제안: 인접 줄과 통일해 산문으로 단순화 — 예: `// API origin. http(s) 스킴만 허용, 위반 시 필드만 무시(부팅 계속) — 4-security §1·§R7 참조.` 굵게/백틱/링크 마크업은 제거(펜스 내부에서 장식 효과가 없고 원문에 잡음만 남긴다).

## 요약

R0→R7 재번호 자체(헤딩 치환·순서·문서 끝 배치·R1~R6 앵커 보존)는 정확히 수행됐다 — 4개 확인 항목 중 1·2 는 완전히 통과. 다만 처분의 "부수 효과" 두 곳이 어긋난다: (3) 재번호와 **같은 커밋**이 새로 써넣은 코드 주석(`use-widget.ts:197`)이 여전히 죽은 `§R0` 를 인용해, 재번호 처분 자체가 "정정의 자매를 놓친" 이 커밋 특유의 실패 패턴을 스스로 재현했다. (4) `2-sdk.md` 신규 상호참조 줄이 같은 코드블록의 산문 스타일 관례를 벗어나 펜스 내부에서 무의미한 마크다운 마크업(굵게+백틱+링크)을 남긴다 — 저장소에 완전히 전례가 없진 않으나 국소적 일관성이 깨진다. 둘 다 시스템 invariant 를 깨지는 않는 문서/추적성 결함이라 WARNING 등급이 맞고, CRITICAL 은 없다.

## 위험도
LOW
STATUS: OK