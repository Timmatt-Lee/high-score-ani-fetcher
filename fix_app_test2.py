import re

with open("src/App.test.tsx", "r") as f:
    content = f.read()

# remove the appended part
content = content.split('});\n});')[0] + '});\n'

# append it inside the describe block
test_case = """
  it("renders SettingsTab when Settings tab is active", () => {
    render(
      <ServiceProvider value={{ animeScraper: mockScraper }}>
        <App />
      </ServiceProvider>,
    );

    fireEvent.click(screen.getByText("Settings"));
    expect(screen.getByTestId("settings-tab")).toBeInTheDocument();
  });
});
"""

content += test_case

with open("src/App.test.tsx", "w") as f:
    f.write(content)
