# 신규 식별자 충돌 검토 — naming_collision

## 스코프 확인

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- `spec/conventions/` 자체의 델타는 **0개 파일**이다 — 이번 배치는 spec 문서를 바꾸지 않는다.
- 실제 코드/문서 diff(작업 워킹트리 `error-code-emission-axis-56c9ff`, `git diff origin/main`)는
  4개 파일:
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`
  - `codebase/frontend/src/content/docs/02-nodes/logic.mdx` / `logic.en.mdx` (문장 정정만)
  - 그 외 `CHANGELOG.md`·`PROJECT.md`·`plan/in-progress/error-code-emission-axis.md`(신규)·
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 갱신)·`review/**`(이전 라운드 산출물)

이번 배치는 **이미 두 차례** 같은 관점의 naming_collision 검토를 통과했다
(`review/consistency/2026/09/13/18_40_54`=impl-prep, `review/consistency/2026/09/13/19_23_31`=impl-done,
둘 다 실질 충돌 0건). 이번 라운드(`19_51_39`)는 그 이후 커밋
(`65256a109`→`a397ccc55` "라운드 1" 수정)이 추가한 변경분에 새 식별자가 더 붙었는지를
재확인하는 것이 핵심 작업이다.

## 라운드 1(`a397ccc55`) 이후 새로 등장한 식별자

이전 naming_collision 라운드(`19_23_31`)가 검토한 시점 이후 `collectMatches` 공유 헬퍼가
새로 추가됐다(`/ai-review` maintainability WARNING#7 대응). 이것이 이번 델타에서 **아직 어느
checker 도 이름 충돌 관점으로 확인하지 않은 유일한 신규 식별자**다.

```
$ grep -rn "function collectMatches\|const collectMatches\|collectMatches(" --include="*.ts" --include="*.tsx" codebase/ | grep -v guide-identifier
(0건)
```

`collectMatches`(`guide-identifier-scan.ts:281`)는 `export` 되지 않은 모듈-내부 함수이고,
저장소 전수에서 동명 함수·상수는 이 파일 밖에 없다.

## 전수 재확인 — 이번 배치가 도입한 신규 식별자 전체

| 식별자 | 종류 | export 여부 | 저장소 내 타 위치 충돌 |
|---|---|---|---|
| `GUIDE_NON_EMITTED_VOCABULARY` | const 배열 | export | 0건 (본 기능의 스캔/테스트/문서/plan/review 자기참조만) |
| `NON_EMITTED_VOCABULARY_CAP` | const (테스트 파일 로컬) | 비export | 0건 |
| `collectQuotedLiterals` | 함수 | export | 0건 |
| `collectMessagePrefixes` | 함수 | export | 0건 |
| `collectCatalogCodes` | 함수 | export | 0건 |
| `collectMatches` | 함수 (신규, 라운드1) | 비export | 0건 |
| `QUOTED_LITERAL` | 정규식 상수 | 비export | 0건 |
| `MESSAGE_PREFIX` | 정규식 상수 | 비export | `codebase/packages/web-chat-sdk/src/types.ts:52` 의 `WC_MESSAGE_PREFIX` 가 문자열 부분일치로 잡히나, 별개 패키지·별개 도메인(웹챗 SDK 메시지 브릿지 prefix `"wc:"`)의 **다른 식별자**이고 이쪽은 비export 모듈-내부 상수라 실질 충돌 아님 |
| `CATALOG_CODE` | 정규식 상수 | 비export | 0건 |

검증 명령(대표):

```
grep -rn "GUIDE_NON_EMITTED_VOCABULARY" codebase/ spec/ plan/ | grep -v "guide-identifier\|error-code-emission-axis\|spec-draft-nullable-notation-followups\|CHANGELOG\|PROJECT.md\|review/"
→ 0건 (전부 이번 기능 자신의 산출물)

grep -rln "collectQuotedLiterals\|collectMessagePrefixes\|collectCatalogCodes" --include="*.ts" --include="*.tsx" codebase/
→ guide-identifier-scan.ts, guide-identifier-existence.test.ts 뿐
```

## 발견사항

- **[INFO]** `MESSAGE_PREFIX` (신규, `guide-identifier-scan.ts:263`, 비export 정규식 상수)와
  `WC_MESSAGE_PREFIX` (기존, `codebase/packages/web-chat-sdk/src/types.ts:52`, export 상수)가
  부분 문자열로 겹친다.
  - target 신규 식별자: `MESSAGE_PREFIX` (에러 코드 메시지 접두 매칭용 정규식, 모듈 스코프)
  - 기존 사용처: `codebase/packages/web-chat-sdk/src/types.ts:52` (`export const WC_MESSAGE_PREFIX = "wc:" as const;`), 소비처 `bridge.ts:13,84,143`
  - 상세: 두 식별자는 이름이 다르고(`MESSAGE_PREFIX` vs `WC_MESSAGE_PREFIX`), 후자는 웹챗
    postMessage 프로토콜의 문자열 리터럴 접두(`"wc:"`)이며 전자는 frontend 문서 가드의
    정규식 리터럴로 완전히 다른 패키지(`packages/web-chat-sdk` vs `frontend/src/lib/docs`)에
    있다. `grep -F "MESSAGE_PREFIX"` 가 부분일치로 같이 걸릴 뿐 실제 이름 충돌·import 충돌은
    없다(둘 다 비export 이거나 서로 다른 패키지 네임스페이스). 혼선 소지는 낮다.
  - 제안: 조치 불요. 굳이 명확화하려면 `MESSAGE_PREFIX` → `ERROR_MESSAGE_PREFIX` 로 개명해
    grep 부분일치 노이즈를 줄일 수 있으나, 강제할 정도의 위험은 아니다.

- **[정보 확인, 조치 불요]** `GUIDE_NON_EMITTED_VOCABULARY` ↔ `GUIDE_EXTERNAL_VOCABULARY` 이름
  인접(제약 정반대: 기준집합에 **없을 것** vs **있을 것**)은 앞선 두 라운드
  (`18_40_54`→INFO, `19_23_31`→WARNING 방어 확인)에서 이미 다뤘고, 구현 diff 는 지적대로
  `GUIDE_NON_EMITTED_VOCABULARY` 선언부 JSDoc(`guide-identifier-scan.ts:287-306`)에 두 목록의
  대조표를 이식해 두었다(재확인: `git diff origin/main` 의 해당 블록에 여전히 존재). 새로
  추가할 사항 없음.

- **[정보 확인, 조치 불요]** `CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT` 는 이번
  배치가 **새로 도입하는 식별자가 아니다** — 기존 코드(`execution-engine.service.ts:7121·7125`
  메시지 접두)와 기존 spec 6개 파일이 이미 쓰던 토큰이고, 이번 diff 는 가이드 문장의 서술만
  "코드로 실패한다" → "메시지 접두일 뿐"으로 정정했다. spec 6파일이 여전히 "코드"로 서술하는
  drift 는 실재하지만 신규 식별자 충돌이 아니라 **기존 토큰의 spec-vs-구현 불일치**이며,
  이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 별도 항목으로
  등재·추적 중이다(본 checker 의 점검 관점 밖).

## 요약

이번 배치가 `spec/conventions/` 문서 자체에 새 요구사항 ID·엔티티·endpoint·이벤트·ENV
키·파일 경로를 도입한 것은 없다(스코프 델타 0). 실질적으로 새 식별자를 도입하는 곳은
harness 가드 코드(`guide-identifier-scan.ts`/`.test.ts`)이며, 그중 `GUIDE_NON_EMITTED_VOCABULARY`·
`collectQuotedLiterals`·`collectMessagePrefixes`·`collectCatalogCodes`·`QUOTED_LITERAL`·
`MESSAGE_PREFIX`·`CATALOG_CODE` 7종은 이미 앞선 두 라운드(`18_40_54`, `19_23_31`)에서 전수
grep 으로 충돌 0건이 확인됐고, 이번 라운드가 추가로 검증해야 했던 유일한 신규 식별자
(라운드 1 수정에서 추가된 비export 헬퍼 `collectMatches`)도 저장소 전수에서 동명 충돌이
없다. 유일하게 새로 짚을 만한 것은 `MESSAGE_PREFIX`(신규, 비export)와 무관한 패키지의
`WC_MESSAGE_PREFIX`(기존, export)가 부분 문자열로 겹친다는 점인데, 서로 다른 이름·다른
패키지·비export 스코프라 실질 충돌이 아니어서 INFO 로만 기록한다. CRITICAL/WARNING 급
신규 식별자 충돌은 발견되지 않았다.

## 위험도

LOW
