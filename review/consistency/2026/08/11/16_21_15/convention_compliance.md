# 정식 규약 준수 검토 — convention_compliance

- 검토 모드: `--impl-done`, scope=`spec/7-channel-web-chat`, diff-base=`origin/main`
- 이번 라운드 델타: 커밋 `df1375208` (코드 주석 2줄, `codebase/channel-web-chat/src/widget/use-widget.ts`). **spec 변경 없음.**
- 직전 라운드 확인 사항(R0→R7 재번호 완결 + 타 문서 5개소 앵커 무손상)이 이번 델타로 훼손되지 않았는지 재확인하는 좁은 스코프의 회귀 점검.

## 재확인 절차 및 결과

### 1. 재번호 상태 (`### R0.` 잔존 0, R1~R7 단조)

- `spec/` 전체에 `### R0.` 패턴 검색 결과 **0건**(잔존 없음).
- `spec/7-channel-web-chat/4-security.md` Rationale 섹션: `R1 → R2 → R3 → R4 → R5 → R6 → R7`(line 177/184/202/219/225/244/272) — 갭·중복 없이 단조 확인. `R7`(`apiBase` 스킴 검증을 두 경로 모두에 거는 이유, 2026-08-11)이 파일 최종 항목이며 그 뒤 orphan 헤더 없음(파일이 R7 본문으로 정상 종료, line 307).
- 참고로 같은 영역의 다른 문서(`0-architecture.md` R1–R5, `1-widget-app.md` R4–R10, `2-sdk.md` R2–R6, `3-auth-session.md` R3–R8, `5-admin-console.md` R1–R7)는 파일별 독립 Rationale 번호 체계이며 이번 델타와 무관 — 각 파일 내부적으로 단조·갭 없음을 함께 확인했다(회귀 없음).
- **타 문서 5개소 앵커**: `4-security.md#r6-공개-webhook-ip-미식별--단일-공유-버킷-완화-한도` 를 참조하는 링크를 전수 검색한 결과 정확히 5개소 확인 —
  - `spec/5-system/12-webhook.md` 3개소 (line 69, 338, 392)
  - `spec/5-system/1-auth.md` 1개소 (line 713)
  - `spec/data-flow/10-triggers.md` 1개소 (line 101)
  모두 `R6`(이번 델타로 번호가 바뀌지 않은 항목)를 가리키므로 앵커 슬러그·타깃 헤딩 텍스트가 여전히 일치. 무손상 확인.

### 2. 새 코드 주석 형식이 저장소 주석 규약과 맞는가

`use-widget.ts` 변경분(JSDoc 1건 + 인라인 주석 1건)의 `SoT: \`4-security.md\` §1.` 표기를 같은 파일·같은 디렉터리의 기존 SoT 주석 관례와 대조:

- 같은 파일 내 기존 관례(line 198 `` 정정 이력은 `4-security.md` **§R7** 참고… ``, line 1326 `` `4-security.md §1`(표 "에러 메시지 노출") ``)와 표기 형식이 동일 — bare 파일명 + `§`섹션, 마크다운 링크 미사용.
- `widget-app.tsx`/`host-bridge.ts`/`widget-state.ts` 등 같은 디렉터리의 다른 파일에서도 `4-security §3-①` 식 bare 표기가 일관되게 쓰인다.
- `spec/conventions/spec-impl-evidence.md` §4.2 가 규정하는 `spec-link-integrity.test.ts` 가드는 코드 주석 내 **마크다운 링크 `[..](path)`** 문법만 대상으로 target 존재·앵커 슬러그를 검사한다. 이번 주석은 마크다운 링크 문법을 쓰지 않는(bare 파일명) 형태이므로 그 가드의 스코프 밖이며, 동시에 이는 파일 내 기존 SoT 주석들과 같은 선택(마크다운 링크 대신 bare 표기)이라 새로운 불일치가 아니다.
- 결론: 이번 주석 형식은 로컬 관례·인접 파일 관례 어느 쪽과도 어긋나지 않는다. INFO 조차 만들 근거 없음.

### 3. `2-sdk.md` 코드펜스 내 주석 정정 보존 여부

`spec/7-channel-web-chat/2-sdk.md` §4 `BootConfig` 코드펜스, line 149:

```
apiBase: string;  // API origin. 런타임 검증: http(s) 스킴만 허용 — 위반 시 그 필드만 무시(부팅은 계속). 4-security.md §1·§R7 참조
```

직전 라운드에서 정정된 그대로 보존되어 있으며 `§1·§R7` 참조가 유효(§1은 문서 본문 정책 섹션, §R7은 위 1항에서 확인한 실재 Rationale 항목)함을 확인. 코드펜스 밖 본문(§4 상단 스키마 설명 등)도 이번 델타와 무관해 변경 없음.

## 부수 확인 (요청 범위 밖, 참고용)

- 변경된 두 주석이 위치한 `use-widget.ts`는 이미 `2-sdk.md` frontmatter `code:` 목록(line 25)에 등재돼 있고, `4-security.md §1` 표(line 39)에서도 "코드 SoT" 로 인라인 인용된다 — 이번 comment-only 델타로 evidence 커버리지 갭이 새로 생기지 않았다.
- 커밋 메시지 자체가 스스로 "spec 은 A 라고 쓰고 코드 주석은 B 라 했다" 류 drift 를 코드→spec 방향(§1 서술)과 정합시키는 처분이라고 밝히고 있어, 이번 검토의 관점(정식 규약 준수)과도 부합하는 정리다.

## 발견사항

없음 — 억지로 만들 근거 없음. 3개 확인 항목 모두 직전 라운드 상태와 동일하게 유효하며, 이번 델타(코드 주석 2줄)는 spec 정식 규약 위반·앵커 손상·재번호 회귀를 일으키지 않았다.

## 요약

이번 라운드의 유일한 델타는 `codebase/channel-web-chat/src/widget/use-widget.ts` 의 주석 2곳 정정(실행 코드 변경 없음, spec 변경 없음)이며, 직전 라운드에서 확정된 `4-security.md` R0→R7 재번호 완결·타 문서 5개소(`12-webhook.md`×3·`1-auth.md`×1·`10-triggers.md`×1) 앵커 무결성·`2-sdk.md` 코드펜스 주석 정정이 모두 그대로 보존돼 있다. 새 코드 주석의 SoT 표기 형식도 동일 파일·인접 파일의 기존 관례와 일치해 저장소 주석 규약상 위반이 없다. 정식 규약(`spec/conventions/**`) 관점에서 이번 델타로 인한 위반·drift 는 발견되지 않았다.

## 위험도

NONE

BLOCK: NO
STATUS: OK
