# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

- 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`
- 실측: `git -C <워크트리> diff origin/main..HEAD --stat -- spec/conventions/` → **0 라인** (변경 없음)
- 이번 브랜치의 실제 diff 는 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` /
  `spec-links.test.ts` (마크다운 링크가 여러 줄에 걸치는 경우를 `extractLinks` 가 놓치던 결함
  수정) 뿐이며, 이는 `spec/conventions/spec-impl-evidence.md` frontmatter 의 기존 `code:` 목록에
  이미 등재된 파일이다. 즉 이 diff 는 **기존 convention 이 이미 참조하는 구현체의 버그 수정**이지,
  `spec/conventions/` 문서 자체가 새 요구사항 ID·엔티티명·endpoint·이벤트명·ENV var·파일 경로를
  새로 도입하는 변경이 아니다.

## 관점별 확인

1. **요구사항 ID 충돌** — 대상 diff 에 신규 요구사항 ID 없음 (`SS-SE-*`, `CCH-SE-*`, `EIA-NX-*` 등
   기존 ID 는 target 문서 본문에 등장하지만 이번 diff 로 신설된 것이 아니라 이미 `origin/main` 에
   존재).
2. **엔티티/타입명 충돌** — diff 가 새로 추가한 타입은 `MaskedDoc` interface, 함수
   `buildMaskedDoc`/`lineForOffset` 뿐. `grep -rn "MaskedDoc|buildMaskedDoc|lineForOffset"
   codebase/ --include="*.ts"` 실측 결과 전부 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
   내부에서만 정의·참조되며 `export` 되지 않는 모듈-내부 helper 다. 다른 영역에서 동명 식별자로
   쓰이는 사례 없음 — 충돌 없음.
3. **API endpoint 충돌** — diff 에 신규 endpoint 없음 (테스트/링크-스캐너 코드 변경).
4. **이벤트/메시지명 충돌** — diff 에 신규 webhook/queue/sse 이벤트명 없음.
5. **환경변수·설정키 충돌** — diff 에 신규 ENV var/config key 없음.
6. **파일 경로 충돌** — 새 spec 파일 없음 (`spec/conventions/` 트리 자체가 unchanged). 코드 변경도
   기존 파일(`spec-links.ts`/`spec-links.test.ts`) 내부 수정이며 신규 파일 생성 없음.

## 발견사항

없음 — 이번 diff 는 `spec/conventions/` 범위에 새 식별자를 하나도 도입하지 않는다.

## 요약

`--impl-done` scope `spec/conventions/` 는 `origin/main` 대비 0 라인 diff 로, 이번 검토 대상 변경은
`spec-impl-evidence.md` 가 이미 SoT 로 참조하는 링크 무결성 스캐너(`spec-links.ts`)의 멀티라인 링크
버그 수정에 그친다. 새로 도입된 코드 심볼(`MaskedDoc`/`buildMaskedDoc`/`lineForOffset`)은 모두
파일-로컬 unexported helper 로, 코드베이스 전수 grep 결과 다른 곳에서 동명으로 쓰이는 사례가 없어
충돌 소지가 없다. 신규 식별자 충돌 관점에서 이번 변경은 무해하다.

## 위험도

NONE
