# 변경 범위(Scope) 리뷰

## 검증 방법

리뷰 payload(3개 파일)를 실제 워크트리(`mermaid-lint-undici-vuln-2956f1`, 커밋 `02d69e324`)의
`git diff origin/main...HEAD`, `git show --stat` 과 대조해 payload 누락 여부를 먼저 확인했다.
결과: **정확히 3개 파일, 24 insertions/9 deletions 로 일치**(누락·추가 파일 없음).

## 발견사항

없음. Critical/Warning 없음.

- **[INFO]** `package.json` 자체는 diff 에 없음(확인됨) — semver range 불변, lockfile 만 갱신
  - 위치: `.claude/tools/mermaid-lint/package.json` (미변경, 참고용 언급)
  - 상세: `npm audit fix`(force 없이)의 정상 산출물임을 실제로 대조 확인했다. `package-lock.json`
    diff 는 정확히 두 패키지(`dompurify`, `undici`)의 `version`/`resolved`/`integrity` 3개 필드만
    바뀌었고, 다른 패키지·포맷팅·정렬 변경은 전무하다. 자동 도구 산출물다운 최소 diff.
  - 제안: 없음(문제 아님, 검증 결과 기록).

- **[INFO]** 한 커밋에 "취약점 해소(반응적 fix)" + "Dependabot 등록(예방적 control)" 두 관심사가
  같이 묶여 있음
  - 위치: `.github/dependabot.yml`, `.claude/tools/mermaid-lint/package-lock.json`
  - 상세: 엄격한 기준으로는 별개 커밋으로 쪼갤 수도 있는 조합이나, 두 항목 모두 같은 plan 항목
    **§F**(`plan/in-progress/harness-guard-followups.md`) 안에서 "mermaid-lint npm 트리 취약점 +
    보안 스캔 갭" 이라는 하나의 단위로 사전에 함께 정의되어 있었고, 이번 diff 의 plan 파일 수정
    자체가 그 근거(Rationale)를 명시한다("근본은 이 npm 트리가 보안 스캔에서 통째로 빠져 있던 것").
    즉 사전 승인된 스코프이지 임의 확장이 아니다.
  - 제안: 없음(문제 아님, 사전 계획된 결합이라는 근거를 기록해 둠).

- **[INFO]** `.github/dependabot.yml` 신규 엔트리에 5줄짜리 배경 설명 주석 포함
  - 위치: `.github/dependabot.yml` 추가된 6~13행 상당
  - 상세: 기존 `github-actions` 엔트리도 2줄 주석을 갖고 있어 스타일 일관성이 있고, "이 트리가
    지금까지 어떤 보안 스캔에도 안 걸렸다"는 비자명한 배경(재발 방지에 중요)을 설명하므로 실질
    변경과 분리되지 않는 정당한 문서화다. 코드 로직과 무관한 주석 추가가 아니라 이 변경 자체를
    설명하는 주석.
  - 제안: 없음(문제 아님).

## 요약

세 파일(`package-lock.json`, `.github/dependabot.yml`, `plan/in-progress/harness-guard-followups.md`)
모두 "mermaid-lint npm 트리의 undici HIGH·dompurify moderate 취약점 해소 + 그 트리를 보안 스캔
사각지대에서 빼내기(Dependabot 등록)" 라는 단일하고 명확한 의도에 정확히 대응한다.
`package-lock.json` 은 `npm audit fix` 자동 산출물 그대로(불필요한 재포맷·타 패키지 변경 없음),
`package.json` 은 손대지 않아 breaking 위험이 없다. `dependabot.yml` 은 기존 블록을 건드리지 않고
새 ecosystem 엔트리만 순수 추가했다. `harness-guard-followups.md` 는 이번 작업이 완료한 §F 항목의
체크박스·설명만 갱신했고 A/B/C/D/E/G 등 무관 항목은 그대로다. 실제 워크트리의
`git diff origin/main...HEAD` 로 대조한 결과 payload 가 누락 없이 전체 변경분(3 파일, 24+/9-)과
정확히 일치했다. 불필요한 리팩토링, 포맷팅 노이즈, 무관한 파일 수정, 사용하지 않는 임포트, 의도치
않은 설정 변경 등 스코프 이탈 징후는 전혀 발견되지 않았다.

## 위험도
NONE
